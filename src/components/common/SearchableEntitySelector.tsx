import { ChevronDown, Search, X } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import { cn } from '../../utils/helper';

interface SearchableEntitySelectorProps<T extends { id: string; name: string }> {
  entities: T[];
  mode: 'single' | 'multi';
  selectedId?: string; // For single mode
  selectedIds?: string[]; // For multi mode
  onSelect: (value: string | string[]) => void;
  label: string;
  entityName: string;
  entityNamePlural: string;
  required?: boolean;
  className?: string;
  disabled?: boolean;
  renderMetadata?: (entity: T) => React.ReactNode;
}

export function SearchableEntitySelector<T extends { id: string; name: string }>({
  entities,
  mode,
  selectedId,
  selectedIds = [],
  onSelect,
  label,
  entityName,
  entityNamePlural,
  required = false,
  className,
  disabled = false,
  renderMetadata,
}: SearchableEntitySelectorProps<T>) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredEntities = entities.filter(entity =>
    entity.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const selectedEntity = mode === 'single'
    ? entities.find(e => e.id === selectedId)
    : null;

  const selectedEntities = mode === 'multi'
    ? entities.filter(e => selectedIds.includes(e.id))
    : [];

  const handleToggle = () => {
    if (!disabled) {
      setIsOpen(!isOpen);
      if (!isOpen) {
        setSearchQuery('');
      }
    }
  };

  const handleSelect = (entityId: string) => {
    if (mode === 'single') {
      onSelect(entityId);
      setIsOpen(false);
    } else {
      const isSelected = selectedIds.includes(entityId);
      if (isSelected) {
        onSelect(selectedIds.filter(id => id !== entityId));
      } else {
        onSelect([...selectedIds, entityId]);
      }
    }
  };

  return (
    <div className={cn("relative", className)} ref={containerRef}>
      <div className="flex items-center justify-between mb-1">
        <label className="block text-sm font-medium text-gray-700">
          {label} {required && <span className="text-red-500">*</span>}
        </label>
        {mode === 'single' && selectedId && !required && (
          <button
            type="button"
            onClick={() => onSelect('')}
            className="text-xs text-red-600 hover:text-red-700 font-medium uppercase"
            disabled={disabled}
          >
            Clear
          </button>
        )}
      </div>

      <div
        onClick={handleToggle}
        className={cn(
          "w-full px-3 py-2 border border-gray-300 rounded-lg bg-white cursor-pointer flex items-center justify-between min-h-[42px]",
          { "bg-gray-50 cursor-not-allowed": disabled },
          { "ring-2 ring-brand-primary border-brand-primary": isOpen }
        )}
      >
        <div className="flex flex-wrap gap-1 items-center">
          {mode === 'single' ? (
            selectedEntity ? (
              <span className="text-sm text-gray-700">{selectedEntity.name}</span>
            ) : (
              <span className="text-sm text-gray-400">Select {entityName}...</span>
            )
          ) : (
            selectedEntities.length > 0 ? (
              selectedEntities.map(e => (
                <span
                  key={e.id}
                  className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-brand-primary/10 text-brand-primary border border-brand-primary/20"
                >
                  {e.name}
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      onSelect(selectedIds.filter(id => id !== e.id));
                    }}
                    className="ml-1 hover:text-brand-d-blue"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))
            ) : (
              <span className="text-sm text-gray-400">Select {entityNamePlural}...</span>
            )
          )}
        </div>
        <ChevronDown className={cn("h-4 w-4 text-gray-400 transition-transform", { "transform rotate-180": isOpen })} />
      </div>

      {isOpen && (
        <div className="absolute z-50 w-full mt-1 pb-6 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className='bg-white border border-gray-200 rounded-lg shadow-lg p-2'>
            {/* Search Input */}
            <div className="relative mb-2">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder={`Search ${entityNamePlural}...`}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-1 focus:ring-brand-primary focus:border-brand-primary"
                autoFocus
                onClick={(e) => e.stopPropagation()}
              />
            </div>

            <div className="max-h-48 overflow-y-auto space-y-1">
              {filteredEntities.map(entity => {
                const isSelected = mode === 'single'
                  ? selectedId === entity.id
                  : selectedIds.includes(entity.id);

                return (
                  <div
                    key={entity.id}
                    onClick={() => handleSelect(entity.id)}
                    className={cn(
                      "px-3 py-2 text-sm rounded-md cursor-pointer transition-colors flex items-center justify-between",
                      isSelected
                        ? "bg-brand-primary text-white"
                        : "text-gray-700 hover:bg-gray-100"
                    )}
                  >
                    <span className="flex-1 truncate">
                      {entity.name}
                      {renderMetadata && renderMetadata(entity)}
                    </span>
                    {isSelected && mode === 'multi' && (
                      <X className="h-3 w-3 ml-2" />
                    )}
                  </div>
                );
              })}

              {filteredEntities.length === 0 && (
                <p className="text-sm text-gray-500 text-center py-4">No {entityNamePlural} found</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
