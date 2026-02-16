import React from 'react';
import type { Category } from '../types/invoice';

interface CategoryBadgeProps {
  category: Category;
  onClick?: () => void;
}

const CategoryBadge: React.FC<CategoryBadgeProps> = ({ category, onClick }) => {
  const getCategoryClass = (cat: Category): string => {
    switch (cat) {
      case 'Digital Service':
        return 'category-badge category-digital';
      case 'Physical Product':
        return 'category-badge category-physical';
      case 'Online Course':
        return 'category-badge category-course';
      default:
        return 'category-badge category-other';
    }
  };

  return (
    <span 
      className={getCategoryClass(category)}
      onClick={onClick}
      style={{ cursor: onClick ? 'pointer' : 'default' }}
    >
      {category}
    </span>
  );
};

export default CategoryBadge;
