import { cn } from '@/lib/utils';
import { ConfigCard } from './ConfigCard';

interface SelectionItem {
  id: string;
  icon?: string;
  title: string;
  description?: string;
  badge?: React.ReactNode;
  accentColor?: string;
}

interface SelectionGridProps {
  items: SelectionItem[];
  value: string;
  onChange: (id: string) => void;
  columns?: 2 | 3;
  className?: string;
}

export function SelectionGrid({ items, value, onChange, columns = 3, className }: SelectionGridProps) {
  return (
    <div
      className={cn(
        'grid gap-3',
        columns === 3 ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3' : 'grid-cols-1 sm:grid-cols-2',
        className
      )}
    >
      {items.map((item) => (
        <ConfigCard
          key={item.id}
          icon={item.icon}
          title={item.title}
          description={item.description}
          badge={item.badge}
          selected={value === item.id}
          onClick={() => onChange(item.id)}
          accentColor={item.accentColor}
        />
      ))}
    </div>
  );
}
