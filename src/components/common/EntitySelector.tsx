
import React, { useState } from 'react';
import { Search } from 'lucide-react';
import { cn } from '../../utils/helper';

interface EntitySelectorProps<T extends { id: string; name: string }> {
  entities: T[];
  mode: 'single' | 'multi';
  selectedId?: string; // For single mode
  selectedIds?: string[]; // For multi mode
  onSelect: (value: string | string[]) => void;
  label: string;
  entityName: string; // e.g., "community", "organization"
  entityNamePlural: string; // e.g., "communities", "organizations"
  required?: boolean;
  className?: string;
  disabled?: boolean;
  renderMetadata?: (entity: T) => React.ReactNode; // Optional function to render additional metadata
}

export function EntitySelector<T extends { id: string; name: string }>({
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
}: EntitySelectorProps<T>): React.ReactElement {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredEntities = entities.filter(entity =>
    entity.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSingleSelect = (entityId: string) => {
    if (selectedId === entityId) {
      onSelect('');
    } else {
      onSelect(entityId);
    }
  };

  const handleMultiSelect = (entityId: string, checked: boolean) => {
    let newIds: string[];
    if (checked) {
      newIds = [...selectedIds, entityId];
    } else {
      newIds = selectedIds.filter(id => id !== entityId);
    }
    onSelect(newIds);
  };

  return (
    <div className={className}>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label} {required && <span className="text-red-500">*</span>}
      </label>

      {/* Search Input */}
      <div className="relative mb-2">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input
          type="text"
          placeholder={`Search ${entityNamePlural}...`}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-9 pr-3 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-1 focus:ring-brand-primary focus:border-brand-primary disabled:bg-gray-100 disabled:cursor-not-allowed"
          disabled={disabled}
        />
      </div>

      <div className="border border-gray-300 rounded-lg max-h-48 overflow-y-auto p-2 space-y-2">
        {filteredEntities.map(entity => {
          return (
            <div key={entity.id} className="flex items-center">
              {mode === 'single' ? (
                <input
                  type="checkbox"
                  name={`${entityName}_select_${label.replace(/\s+/g, '_')}`}
                  id={`${entityName}-${entity.id}`}
                  value={entity.id}
                  checked={selectedId === entity.id}
                  onChange={() => handleSingleSelect(entity.id)}
                  className="h-4 w-4 text-brand-primary focus:ring-brand-primary border-gray-300 rounded mr-2"
                  required={required && !selectedId}
                  disabled={disabled}
                />
              ) : (
                <input
                  type="checkbox"
                  id={`${entityName}-${entity.id}`}
                  checked={selectedIds.includes(entity.id)}
                  onChange={(e) => handleMultiSelect(entity.id, e.target.checked)}
                  className="h-4 w-4 text-brand-primary focus:ring-brand-primary border-gray-300 rounded mr-2"
                  disabled={disabled}
                />
              )}

              <label
                htmlFor={`${entityName}-${entity.id}`}
                className={cn("text-sm select-none cursor-pointer flex-1 text-gray-700", { "cursor-not-allowed text-gray-400": disabled })}
              >
                {entity.name}
                {renderMetadata && renderMetadata(entity)}
              </label>
            </div>
          );
        })}

        {filteredEntities.length === 0 && (
          <p className="text-sm text-gray-500 text-center py-2">No {entityNamePlural} found</p>
        )}
      </div>
    </div>
  );
}
