import React, { useMemo } from 'react';
import { linkHorizontal, linkVertical } from 'd3-shape';
import { motion } from 'framer-motion';

export default function Link({
  linkData,
  orientation,
  pathFunc,
  pathClassFunc,
  transitionDuration,
  onClick,
  onMouseOver,
  onMouseOut,
}) {
  const path = useMemo(() => {
    if (typeof pathFunc === 'function') {
      return pathFunc(linkData, orientation);
    }

    const { source, target } = linkData;

    return orientation === 'horizontal'
      ? linkHorizontal()({
          source: [source.y, source.x],
          target: [target.y, target.x],
        })
      : linkVertical()({
          source: [source.x, source.y],
          target: [target.x, target.y],
        });
  }, [linkData, orientation, pathFunc]);

  const className = useMemo(() => {
    const classes = ['rd3t-link'];
    if (typeof pathClassFunc === 'function') {
      classes.push(pathClassFunc(linkData, orientation));
    }
    return classes.join(' ');
  }, [linkData, orientation, pathClassFunc]);

  return (
    <motion.path
      layout
      className={className}
      d={path}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: transitionDuration / 1000 }}
      onClick={(evt) =>
        onClick(linkData.source, linkData.target, evt)
      }
      onMouseOver={(evt) =>
        onMouseOver(linkData.source, linkData.target, evt)
      }
      onMouseOut={(evt) =>
        onMouseOut(linkData.source, linkData.target, evt)
      }
    />
  );
}