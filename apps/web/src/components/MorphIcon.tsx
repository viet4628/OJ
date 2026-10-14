import React from 'react';
import { MorphIcon as BaseMorphIcon, type MorphIconProps } from 'morphicons/react';
import type { IconNode } from 'morphicons';

/**
 * Normalizes Lucide vanilla data (['svg', attrs, children]) or standard IconNode
 * into the shape expected by morphicons.
 */
export function getIconNode(icon: any): IconNode {
  if (!icon) return [] as unknown as IconNode;
  if (Array.isArray(icon) && icon[0] === 'svg' && Array.isArray(icon[2])) {
    return icon[2] as unknown as IconNode;
  }
  return icon as unknown as IconNode;
}

export interface AppMorphIconProps extends Omit<MorphIconProps, 'icon' | 'from' | 'to'> {
  icon?: any;
  from?: any;
  to?: any;
}

export default function MorphIcon({ icon, from, to, spring = 'snappy', ...rest }: AppMorphIconProps) {
  return (
    <BaseMorphIcon
      icon={icon ? getIconNode(icon) : undefined}
      from={from ? getIconNode(from) : undefined}
      to={to ? getIconNode(to) : undefined}
      spring={spring}
      {...rest}
    />
  );
}

