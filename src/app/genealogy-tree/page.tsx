'use client';

import dynamic from "next/dynamic";
import React, { useEffect, useRef, useState } from 'react';
import treeData_ from './new_treeData.json';
import { TreeNodeDatum } from 'react-d3-tree';
const Tree = dynamic(() => import("react-d3-tree"), { ssr: false });

function renderNode({ nodeDatum }: { nodeDatum: TreeNodeDatum }): React.JSX.Element {
  return (
    <g>
      <rect width="200" height="100" x="-100" y="-50" rx="10" ry="10" fill="#fff" stroke="#333" strokeWidth={2}/>
      {/* <circle r={30} fill="#fff" stroke="#333" strokeWidth={2}></circle> */}
      <text x="0" y="0" textAnchor="middle" dominantBaseline="middle" fill="black" strokeWidth="0">
        {nodeDatum.name}
      </text>
    </g>
  )
};

// Tree visualization
export default function GenealogyTree() {
  const [translate, setTranslate] = useState({ x: 0, y: 0 });
  const treeContainer = useRef<HTMLDivElement>(null);

  // Lấy kích thước container để căn giữa cây
  const handleContainerRef = (containerRef: HTMLDivElement | null) => {
    if (containerRef && !translate.x && !translate.y) {
      const dimensions = containerRef.getBoundingClientRect();
      setTranslate({
        x: dimensions.width / 2,
        y: dimensions.height / 6,
      });
      treeContainer.current = containerRef;
    }
  };

  return (
    <div
      ref={handleContainerRef}
      className="w-full h-screen bg-gray-100 overflow-hidden"
    >
      <Tree
        data={treeData_}
        renderCustomNodeElement={renderNode}
        nodeSize={{x: 250, y: 150}}
        translate={translate}
        zoomable={true}
        zoom={0.9} // mức zoom mặc định
        scaleExtent={{ min: 0.5, max: 2 }} // Giới hạn zoom
        orientation="vertical" // Cây dọc
        collapsible={true}
        separation={{ siblings: 0.8, nonSiblings: 1.5 }} // khoảng cách node
        pathFunc="step" // Kiểu đường nối
        draggable={true} // bật kéo
      />
    </div>
  );
}
