'use client';

import React from 'react';
import { resolveStorageUrl } from '@/lib/storage-url';
import { cn } from '@/lib/utils';
import { ImageIcon } from 'lucide-react';

type StorageImageProps = {
  imagePath: string | null | undefined;
  alt: string;
  width?: number;
  height?: number;
  className?: string;
  fill?: boolean;
  sizes?: string;
  style?: React.CSSProperties;
  objectFit?: string;
};

export const StorageImage: React.FC<StorageImageProps> = ({
  imagePath,
  alt,
  width,
  height,
  className,
  fill,
}) => {
  const resolvedUrl = resolveStorageUrl(imagePath);
  const styleProps = width && height ? { width, height } : {};

  if (!resolvedUrl) {
    return (
      <div
        className={cn(
          'flex items-center justify-center bg-muted text-muted-foreground',
          className
        )}
        style={styleProps}
      >
        <ImageIcon className="h-1/2 w-1/2 opacity-50" />
      </div>
    );
  }

  const imgStyle: React.CSSProperties = fill
    ? { position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }
    : styleProps;

  return (
    <img
      alt={alt}
      src={resolvedUrl}
      className={className}
      style={imgStyle}
      {...(width && !fill ? { width } : {})}
      {...(height && !fill ? { height } : {})}
    />
  );
};
