
import React, { useState } from 'react';
import { Search } from 'lucide-react';
import { Community } from '../../types';
import { cn } from '../../utils/helper';

interface CommunitySelectorProps {
  communities: Community[];
  mode: 'single' | 'multi';
  selectedId?: string; // For single mode
  selectedIds?: string[]; // For multi mode
  onSelect: (value: string | string[]) => void;
  label: string;
  required?: boolean;
  className?: string;
  disabled?: boolean;
}

export const CommunitySelector: React.FC<CommunitySelectorProps> = ({
  communities,
  mode,
  selectedId,
  selectedIds = [],
  onSelect,
  label,
  required = false,
  className,
  disabled = false,
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredCommunities = communities.filter(c =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSingleSelect = (communityId: string) => {
    onSelect(communityId);
  };

  const handleMultiSelect = (communityId: string, checked: boolean) => {
    let newIds: string[];
    if (checked) {
      newIds = [...selectedIds, communityId];
    } else {
      newIds = selectedIds.filter(id => id !== communityId);
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
          placeholder="Search communities..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-9 pr-3 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-1 focus:ring-brand-primary focus:border-brand-primary disabled:bg-gray-100 disabled:cursor-not-allowed"
          disabled={disabled}
        />
      </div>

      <div className="border border-gray-300 rounded-lg max-h-48 overflow-y-auto p-2 space-y-2">
        {filteredCommunities.map(community => {
          const isOrgCommunity = !!community.organization_id;

          return (
            <div key={community.id} className="flex items-center">
              {mode === 'single' ? (
                <input
                  type="radio"
                  name={`community_select_${label.replace(/\s+/g, '_')}`}
                  id={`community-${community.id}`}
                  value={community.id}
                  checked={selectedId === community.id}
                  onChange={() => handleSingleSelect(community.id)}
                  className="h-4 w-4 text-brand-primary focus:ring-brand-primary border-gray-300 rounded-full mr-2"
                  required={required}
                  disabled={disabled}
                />
              ) : (
                <input
                  type="checkbox"
                  id={`managed-${community.id}`}
                  checked={selectedIds.includes(community.id)}
                  onChange={(e) => handleMultiSelect(community.id, e.target.checked)}
                  className="h-4 w-4 text-brand-primary focus:ring-brand-primary border-gray-300 rounded mr-2"
                  disabled={disabled}
                />
              )}


              <label
                htmlFor={mode === 'single' ? `community-${community.id}` : `managed-${community.id}`}
                className={cn("text-sm select-none cursor-pointer flex-1 text-gray-700", { "cursor-not-allowed text-gray-400": disabled })}
              >
                {community.name}
                {isOrgCommunity && (
                  <span className="text-xs text-gray-500 ml-2">
                    (Org: {community.organization?.name})
                  </span>
                )}
              </label>
            </div>
          );
        })}

        {filteredCommunities.length === 0 && (
          <p className="text-sm text-gray-500 text-center py-2">No communities found</p>
        )}
      </div>
    </div>
  );
};
