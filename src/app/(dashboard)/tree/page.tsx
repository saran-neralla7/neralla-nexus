'use client';

import { useEffect, useState, useRef, useTransition } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { useUser } from '@/hooks/useUser';
import { toast } from 'sonner';
import { getInitials, getAvatarStyle } from '@/lib/utils';
import NexusModal from '@/components/nexus/NexusModal';
import NexusConfirm from '@/components/nexus/NexusConfirm';
import type { FamilyMember, FamilyTreeNode } from '@/types';

interface NodeWithMember extends FamilyTreeNode {
  member: FamilyMember;
}

export default function TreePage() {
  const { user } = useUser();
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [nodes, setNodes] = useState<NodeWithMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();

  // Canvas Viewport State
  const [zoom, setZoom] = useState(1.0);
  const [pan, setPan] = useState({ x: 100, y: 100 });
  const [isPanning, setIsPanning] = useState(false);
  const [interactionMode, setInteractionMode] = useState<'drag' | 'pan'>('drag');
  
  // Dragging Node State
  const [draggedNodeId, setDraggedNodeId] = useState<string | null>(null);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [nodeOffset, setNodeOffset] = useState({ x: 0, y: 0 });

  // Selected Node / Relation Modals
  const [selectedNode, setSelectedNode] = useState<NodeWithMember | null>(null);
  const [showRelationModal, setShowRelationModal] = useState(false);
  const [parentSelection, setParentSelection] = useState<string>('none');
  const [spouseSelection, setSpSelection] = useState<string>('none');
  const [relationshipType, setRelationshipType] = useState<string>('father');

  // Add Member Modal
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [newMemberName, setNewMemberName] = useState('');
  const [newMemberRelation, setNewMemberRelation] = useState('Son');

  // Sidebar mapping state
  const [showUnmappedSidebar, setShowUnmappedSidebar] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ id: string; startX: number; startY: number; initX: number; initY: number } | null>(null);

  // Load Data
  const fetchData = async () => {
    if (!user?.family_id) return;
    try {
      setLoading(true);
      const supabase = createClient();

      // Fetch family members
      const { data: membersData, error: mError } = await supabase
        .from('family_members')
        .select('*')
        .eq('family_id', user.family_id)
        .order('full_name', { ascending: true });

      if (mError) throw mError;
      setMembers(membersData || []);

      // Fetch family tree nodes
      const { data: nodesData, error: nError } = await supabase
        .from('family_tree_nodes')
        .select('*')
        .eq('family_id', user.family_id);

      if (nError) throw nError;

      // Join nodes with member details
      const joinedNodes: NodeWithMember[] = (nodesData || []).map((node) => {
        const mem = (membersData || []).find((m) => m.id === node.member_id);
        return {
          ...node,
          position_x: Number(node.position_x) || 0,
          position_y: Number(node.position_y) || 0,
          member: mem || {
            id: node.member_id,
            family_id: node.family_id,
            full_name: 'Unknown Member',
            created_at: new Date().toISOString(),
          },
        };
      });

      setNodes(joinedNodes);
    } catch (err: any) {
      toast.error(err.message || 'Failed to fetch tree data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.family_id) {
      fetchData();
    }
  }, [user]);

  // Add Member node directly to tree
  const handleAddMemberToTree = async (memberId: string) => {
    if (!user?.family_id) return;
    try {
      const supabase = createClient();
      
      // Calculate coordinates around center of screen view
      const x = Math.round(400 - pan.x);
      const y = Math.round(250 - pan.y);

      const { data, error } = await supabase
        .from('family_tree_nodes')
        .insert({
          family_id: user.family_id,
          member_id: memberId,
          position_x: x,
          position_y: y,
          metadata: {},
        })
        .select()
        .single();

      if (error) throw error;

      toast.success('Member added to tree. Drag to arrange!');
      await fetchData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to add member to tree');
    }
  };

  // Create new member and add to tree
  const handleCreateAndAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMemberName.trim() || !user?.family_id) return;

    try {
      const supabase = createClient();

      // 1. Create family member
      const { data: member, error: mError } = await supabase
        .from('family_members')
        .insert({
          family_id: user.family_id,
          full_name: newMemberName,
          relationship: newMemberRelation,
        })
        .select()
        .single();

      if (mError) throw mError;

      // 2. Create tree node
      const x = Math.round(400 - pan.x);
      const y = Math.round(200 - pan.y);

      const { error: tError } = await supabase
        .from('family_tree_nodes')
        .insert({
          family_id: user.family_id,
          member_id: member.id,
          position_x: x,
          position_y: y,
        });

      if (tError) throw tError;

      toast.success(`${newMemberName} added to family and tree!`);
      setNewMemberName('');
      setShowAddMemberModal(false);
      await fetchData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to create member');
    }
  };

  // Remove node from tree (does not delete family member profile)
  const handleRemoveNode = async (nodeId: string) => {
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from('family_tree_nodes')
        .delete()
        .eq('id', nodeId);

      if (error) throw error;

      toast.success('Removed node from tree');
      setSelectedNode(null);
      await fetchData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to remove node');
    }
  };

  // Set / Update relationships
  const handleSaveRelationships = async () => {
    if (!selectedNode) return;
    try {
      const supabase = createClient();
      
      const parentId = parentSelection === 'none' ? null : parentSelection;
      const spouseId = spouseSelection === 'none' ? null : spouseSelection;
      
      // Update parent_id & relationship
      const { error: nodeError } = await supabase
        .from('family_tree_nodes')
        .update({
          parent_id: parentId,
          relationship_to_parent: parentId ? relationshipType : null,
          metadata: {
            ...selectedNode.metadata,
            spouse_node_id: spouseId,
          },
        })
        .eq('id', selectedNode.id);

      if (nodeError) throw nodeError;

      // If spouse is selected, also link spouse back bidirectionally for ease of display
      if (spouseId) {
        const spouseNode = nodes.find((n) => n.id === spouseId);
        if (spouseNode) {
          await supabase
            .from('family_tree_nodes')
            .update({
              metadata: {
                ...spouseNode.metadata,
                spouse_node_id: selectedNode.id,
              },
            })
            .eq('id', spouseId);
        }
      }

      toast.success('Relationships updated');
      setShowRelationModal(false);
      await fetchData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save relationships');
    }
  };

  // Auto-Arrange Layout Algorithm
  const handleAutoLayout = async () => {
    if (nodes.length === 0 || !user?.family_id) return;

    startTransition(async () => {
      try {
        const updatedNodes = [...nodes];
        
        // 1. Build a simple graph structure
        const nodesById = new Map<string, NodeWithMember>();
        updatedNodes.forEach((n) => nodesById.set(n.id, n));

        // Group children by parent
        const childrenMap = new Map<string, string[]>(); // parentNodeId -> childrenNodeIds
        updatedNodes.forEach((n) => {
          if (n.parent_id) {
            const arr = childrenMap.get(n.parent_id) || [];
            arr.push(n.id);
            childrenMap.set(n.parent_id, arr);
          }
        });

        // Track who is placed to avoid infinite loops and arrange horizontally
        const placed = new Set<string>();
        const layers = new Map<number, string[]>(); // depth -> nodeIds

        // Find roots (nodes with no parents)
        const roots = updatedNodes.filter((n) => !n.parent_id);

        const traverse = (nodeId: string, depth: number) => {
          if (placed.has(nodeId)) return;
          placed.add(nodeId);

          const layerNodes = layers.get(depth) || [];
          layerNodes.push(nodeId);
          layers.set(depth, layerNodes);

          // Get children
          const children = childrenMap.get(nodeId) || [];
          children.forEach((cId) => traverse(cId, depth + 1));

          // Get spouse
          const node = nodesById.get(nodeId);
          const spouseId = node?.metadata?.spouse_node_id;
          if (spouseId && !placed.has(spouseId)) {
            // Place spouse in same layer right next to this node
            traverse(spouseId, depth);
          }
        };

        // Run traversal from roots
        roots.forEach((root) => traverse(root.id, 0));

        // Place remaining orphans if any
        updatedNodes.forEach((n) => {
          if (!placed.has(n.id)) {
            traverse(n.id, 0);
          }
        });

        // 2. Assign coordinates based on layers
        const horizontalSpacing = 220;
        const verticalSpacing = 160;

        const supabase = createClient();
        
        // Prepare bulk update promises
        const updates = Array.from(layers.entries()).flatMap(([depth, nodeIds]) => {
          const totalWidth = (nodeIds.length - 1) * horizontalSpacing;
          const startX = -totalWidth / 2 + 300; // Center around x=300
          const y = depth * verticalSpacing + 100;

          return nodeIds.map((nId, idx) => {
            const x = startX + idx * horizontalSpacing;
            return supabase
              .from('family_tree_nodes')
              .update({ position_x: Math.round(x), position_y: Math.round(y) })
              .eq('id', nId);
          });
        });

        await Promise.all(updates);
        toast.success('Tree auto-arranged successfully!');
        await fetchData();
        // Reset pan to center it nicely
        setPan({ x: 150, y: 50 });
        setZoom(1.0);
      } catch (err: any) {
        toast.error(err.message || 'Auto-layout failed');
      }
    });
  };

  // Canvas Mouse Interactions (Pan / Zoom)
  const handleCanvasMouseDown = (e: React.MouseEvent<SVGSVGElement>) => {
    // If user clicks directly on background/svg, trigger panning
    if (e.target === e.currentTarget || interactionMode === 'pan') {
      setIsPanning(true);
      setDragStart({ x: e.clientX, y: e.clientY });
    }
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (isPanning) {
      const dx = e.clientX - dragStart.x;
      const dy = e.clientY - dragStart.y;
      setPan((prev) => ({ x: prev.x + dx, y: prev.y + dy }));
      setDragStart({ x: e.clientX, y: e.clientY });
    } else if (draggedNodeId && dragRef.current) {
      // Direct drag handling for nodes
      const dx = (e.clientX - dragRef.current.startX) / zoom;
      const dy = (e.clientY - dragRef.current.startY) / zoom;

      setNodes((prev) =>
        prev.map((n) => {
          if (n.id === dragRef.current!.id) {
            return {
              ...n,
              position_x: Math.round(dragRef.current!.initX + dx),
              position_y: Math.round(dragRef.current!.initY + dy),
            };
          }
          return n;
        })
      );
    }
  };

  const handleCanvasMouseUp = async () => {
    if (isPanning) {
      setIsPanning(false);
    } else if (draggedNodeId && dragRef.current) {
      const node = nodes.find((n) => n.id === draggedNodeId);
      setDraggedNodeId(null);
      dragRef.current = null;

      if (node) {
        try {
          const supabase = createClient();
          await supabase
            .from('family_tree_nodes')
            .update({
              position_x: node.position_x,
              position_y: node.position_y,
            })
            .eq('id', node.id);
        } catch (err) {
          console.error('Failed to save position:', err);
        }
      }
    }
  };

  // Node Drag Handlers
  const handleNodeMouseDown = (e: React.MouseEvent, node: NodeWithMember) => {
    e.stopPropagation();
    if (interactionMode === 'pan') return;

    setDraggedNodeId(node.id);
    dragRef.current = {
      id: node.id,
      startX: e.clientX,
      startY: e.clientY,
      initX: node.position_x,
      initY: node.position_y,
    };
  };

  // Wheel Zoom
  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    const zoomFactor = 1.05;
    const newZoom = e.deltaY < 0 ? zoom * zoomFactor : zoom / zoomFactor;
    setZoom(Math.max(0.3, Math.min(3.0, newZoom)));
  };

  // Helper lists
  const unmappedMembers = members.filter(
    (m) => !nodes.some((n) => n.member_id === m.id)
  );

  // Render Relationship Connections
  const renderConnections = () => {
    const lines: React.ReactNode[] = [];
    const spouseLinePairs = new Set<string>();

    nodes.forEach((node) => {
      // 1. Parent Connection
      if (node.parent_id) {
        const parent = nodes.find((n) => n.id === node.parent_id);
        if (parent) {
          // Node coordinate centers (taking node card width=180, height=80 into account)
          const px = parent.position_x + 90;
          const py = parent.position_y + 80;
          const cx = node.position_x + 90;
          const cy = node.position_y;

          // Drawing bezier curve from parent bottom to child top
          const pathD = `M ${px} ${py} C ${px} ${(py + cy) / 2}, ${cx} ${(py + cy) / 2}, ${cx} ${cy}`;
          lines.push(
            <g key={`p-${parent.id}-${node.id}`}>
              {/* Glow background line */}
              <path
                d={pathD}
                fill="none"
                stroke="rgba(79, 219, 200, 0.15)"
                strokeWidth="4"
                className="blur-sm"
              />
              {/* Main line */}
              <path
                d={pathD}
                fill="none"
                stroke="rgba(79, 219, 200, 0.4)"
                strokeWidth="2"
              />
            </g>
          );
        }
      }

      // 2. Spouse Connection
      const spouseId = node.metadata?.spouse_node_id;
      if (spouseId) {
        const key = [node.id, spouseId].sort().join('-');
        if (!spouseLinePairs.has(key)) {
          spouseLinePairs.add(key);
          const spouse = nodes.find((n) => n.id === spouseId);
          if (spouse) {
            // Draw horizontal connection line
            const n1x = node.position_x + 180; // Right edge of card 1
            const n1y = node.position_y + 40;  // Vertical middle
            const n2x = spouse.position_x;     // Left edge of card 2
            const n2y = spouse.position_y + 40; // Vertical middle

            // Handle horizontal overlap or side positioning
            const midX = (n1x + n2x) / 2;
            const midY = (n1y + n2y) / 2;

            lines.push(
              <g key={`s-${key}`}>
                {/* Dashed spouse connector */}
                <path
                  d={`M ${node.position_x + 90} ${node.position_y + 40} L ${spouse.position_x + 90} ${spouse.position_y + 40}`}
                  fill="none"
                  stroke="rgba(255, 181, 158, 0.5)"
                  strokeWidth="2.5"
                  strokeDasharray="4 4"
                />
                <circle
                  cx={(node.position_x + spouse.position_x) / 2 + 90}
                  cy={(node.position_y + spouse.position_y) / 2 + 40}
                  r="5"
                  fill="#ffb59e"
                  className="animate-pulse"
                />
              </g>
            );
          }
        }
      }
    });

    return lines;
  };

  return (
    <div className="relative h-[calc(100vh-80px)] md:h-[calc(100vh-64px)] w-full overflow-hidden select-none bg-[#090f0e]">
      
      {/* 1. Header and Quick Actions */}
      <div className="absolute top-4 left-4 sm:top-6 sm:left-6 z-10 space-y-2 pointer-events-auto">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center bg-[#adc6ff]/10 border border-[#adc6ff]/20">
            <span className="material-symbols-outlined text-[#adc6ff] text-[18px] sm:text-[22px]" style={{ fontVariationSettings: "'FILL' 1" }}>
              account_tree
            </span>
          </div>
          <div>
            <h1 className="text-headline-sm sm:text-headline-md font-bold text-[#dde4e1] leading-tight">Family Tree</h1>
            <p className="text-[11px] sm:text-body-sm text-[#859490]">Build and visualise family lines</p>
          </div>
        </div>
      </div>

      <div className="absolute top-4 right-4 sm:top-6 sm:right-6 z-10 flex items-center gap-1.5 sm:gap-2 pointer-events-auto">
        {/* Auto Arrange */}
        <button
          onClick={handleAutoLayout}
          disabled={isPending}
          className="flex items-center gap-1.5 px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl text-label-sm font-medium transition-all bg-white/5 border border-white/8 text-[#bbcac6] hover:bg-white/10 hover:text-white"
        >
          <span className="material-symbols-outlined text-[16px] sm:text-[18px]">magic_button</span>
          <span className="hidden sm:inline">{isPending ? 'Arranging...' : 'Auto Layout'}</span>
        </button>

        {/* Unmapped count / Sidebar toggle */}
        <button
          onClick={() => setShowUnmappedSidebar(!showUnmappedSidebar)}
          className="relative flex items-center gap-1.5 px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl text-label-sm font-medium transition-all bg-white/5 border border-white/8 text-[#bbcac6] hover:bg-white/10 hover:text-white"
        >
          <span className="material-symbols-outlined text-[16px] sm:text-[18px]">group_add</span>
          <span className="hidden sm:inline">Add Member</span>
          {unmappedMembers.length > 0 && (
            <span className="absolute -top-1 -right-1 sm:-top-1.5 sm:-right-1.5 w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-full bg-[#14b8a6] text-[8px] sm:text-[9px] text-white flex items-center justify-center font-bold">
              {unmappedMembers.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setShowAddMemberModal(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl text-label-sm font-semibold transition-all bg-[#4fdbc8] text-[#003731] hover:bg-[#4fdbc8]/90"
        >
          <span className="material-symbols-outlined text-[16px] sm:text-[18px]">person_add</span>
          <span className="hidden sm:inline">New Profile</span>
        </button>
      </div>

      {/* 2. Interactive SVG Canvas */}
      <div
        ref={containerRef}
        className="w-full h-full cursor-grab active:cursor-grabbing"
        onWheel={handleWheel}
        style={{ cursor: interactionMode === 'pan' ? (isPanning ? 'grabbing' : 'grab') : 'default' }}
      >
        <svg
          className="w-full h-full"
          onMouseDown={handleCanvasMouseDown}
          onMouseMove={handleCanvasMouseMove}
          onMouseUp={handleCanvasMouseUp}
          onMouseLeave={handleCanvasMouseUp}
        >
          <defs>
            {/* Grid background */}
            <pattern id="tree-grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(255, 255, 255, 0.015)" strokeWidth="1" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#tree-grid)" />

          {/* Scale & translate graph container */}
          <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
            {/* Connections */}
            {renderConnections()}

            {/* Nodes */}
            {nodes.map((node) => {
              const isSelected = selectedNode?.id === node.id;
              const hasUser = !!node.member.user_id;

              return (
                <g
                  key={node.id}
                  transform={`translate(${node.position_x}, ${node.position_y})`}
                  className="cursor-pointer"
                  onMouseDown={(e) => handleNodeMouseDown(e, node)}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedNode(node);
                    setParentSelection(node.parent_id || 'none');
                    setSpSelection(node.metadata?.spouse_node_id || 'none');
                    setRelationshipType(node.relationship_to_parent || 'father');
                  }}
                >
                  <foreignObject width="180" height="80" requiredFeatures="http://www.w3.org/TR/SVG11/feature#Extensibility">
                    <div
                      className={`w-full h-full rounded-2xl flex items-center gap-3 px-3.5 border transition-all ${
                        isSelected
                          ? 'bg-[#1a211f]/95 border-[#4fdbc8] shadow-[0_0_15px_rgba(79,219,200,0.3)] ring-1 ring-[#4fdbc8]'
                          : 'bg-[#0e1513]/85 backdrop-blur-md border-white/8 hover:border-white/20'
                      }`}
                    >
                      {/* Avatar */}
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-xs font-bold shrink-0 relative overflow-hidden"
                        style={{ 
                          background: node.member.avatar_url ? 'transparent' : getAvatarStyle(node.member.full_name) 
                        }}
                      >
                        {node.member.avatar_url ? (
                          <img
                            src={node.member.avatar_url}
                            alt={node.member.full_name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          getInitials(node.member.full_name)
                        )}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1">
                          <h3 className="text-body-sm font-semibold text-[#dde4e1] truncate">
                            {node.member.full_name}
                          </h3>
                          {hasUser && (
                            <span className="material-symbols-outlined text-[12px] text-[#4fdbc8]" title="Linked User Account">
                              verified
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-[#859490] font-mono capitalize">
                          {node.member.relationship || 'Member'}
                        </p>
                        {node.member.date_of_birth && (
                          <p className="text-[9px] text-[#859490] font-mono mt-0.5">
                            Born {new Date(node.member.date_of_birth).getFullYear()}
                          </p>
                        )}
                      </div>
                    </div>
                  </foreignObject>
                </g>
              );
            })}
          </g>
        </svg>
      </div>

      {/* 3. Floating Navigation Canvas Controls */}
      <div className="absolute bottom-6 right-6 z-10 flex flex-col md:flex-row items-center gap-3 pointer-events-auto bg-[#161d1b]/90 border border-white/5 backdrop-blur-md px-3 py-2 rounded-2xl">
        {/* Mode Selector */}
        <div className="flex border-b md:border-b-0 md:border-r border-white/5 pb-2 md:pb-0 md:pr-2 gap-1">
          <button
            onClick={() => setInteractionMode('drag')}
            className={`p-2 rounded-xl text-label-sm font-medium flex items-center gap-1.5 transition-all ${
              interactionMode === 'drag' ? 'bg-[#4fdbc8]/15 text-[#4fdbc8]' : 'text-[#859490] hover:text-white'
            }`}
            title="Drag Node Mode"
          >
            <span className="material-symbols-outlined text-[18px]">drag_pan</span>
            <span className="hidden md:inline">Arrange</span>
          </button>
          <button
            onClick={() => setInteractionMode('pan')}
            className={`p-2 rounded-xl text-label-sm font-medium flex items-center gap-1.5 transition-all ${
              interactionMode === 'pan' ? 'bg-[#4fdbc8]/15 text-[#4fdbc8]' : 'text-[#859490] hover:text-white'
            }`}
            title="Pan Canvas Mode"
          >
            <span className="material-symbols-outlined text-[18px]">pan_tool</span>
            <span className="hidden md:inline">Pan</span>
          </button>
        </div>

        {/* Zoom Operations */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => setZoom(Math.max(0.3, zoom - 0.1))}
            className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-white/5 text-[#bbcac6] hover:text-white transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]">remove</span>
          </button>
          <span className="text-[11px] font-mono text-[#bbcac6] w-12 text-center select-none">
            {Math.round(zoom * 100)}%
          </span>
          <button
            onClick={() => setZoom(Math.min(3.0, zoom + 0.1))}
            className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-white/5 text-[#bbcac6] hover:text-white transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
          </button>
          <div className="w-px h-5 bg-white/5 mx-1" />
          <button
            onClick={() => {
              setZoom(1.0);
              setPan({ x: 150, y: 100 });
            }}
            className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-white/5 text-[#bbcac6] hover:text-white transition-colors"
            title="Reset view"
          >
            <span className="material-symbols-outlined text-[18px]">restart_alt</span>
          </button>
        </div>
      </div>

      {/* 4. Left Sidebar details panel */}
      {selectedNode && (
        <div className="absolute top-24 left-6 bottom-24 w-80 z-20 pointer-events-auto bg-[#161d1b]/95 border border-white/8 backdrop-blur-xl rounded-3xl flex flex-col overflow-hidden shadow-2xl animate-in fade-in slide-in-from-left-4 duration-300">
          <div className="p-5 border-b border-white/5 flex items-center justify-between">
            <h2 className="text-headline-sm font-semibold text-[#dde4e1]">Profile Details</h2>
            <button
              onClick={() => setSelectedNode(null)}
              className="p-1 rounded-lg hover:bg-white/5 text-[#859490] hover:text-white"
            >
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-5 space-y-6">
            {/* Quick Profile Summary */}
            <div className="text-center">
              <div
                className="w-16 h-16 rounded-2xl mx-auto flex items-center justify-center text-white text-xl font-bold mb-3 relative overflow-hidden"
                style={{ 
                  background: selectedNode.member.avatar_url ? 'transparent' : getAvatarStyle(selectedNode.member.full_name) 
                }}
              >
                {selectedNode.member.avatar_url ? (
                  <img
                    src={selectedNode.member.avatar_url}
                    alt={selectedNode.member.full_name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  getInitials(selectedNode.member.full_name)
                )}
              </div>
              <h3 className="text-body-lg font-bold text-white">{selectedNode.member.full_name}</h3>
              <p className="text-label-sm text-[#4fdbc8] capitalize">{selectedNode.member.relationship || 'Family Member'}</p>
            </div>

            {/* Basic Info Details */}
            <div className="space-y-3 p-4 rounded-2xl bg-white/3 border border-white/5 text-body-sm text-[#bbcac6]">
              {selectedNode.member.date_of_birth && (
                <div className="flex justify-between">
                  <span className="text-[#859490]">Born:</span>
                  <span>{new Date(selectedNode.member.date_of_birth).toLocaleDateString('en-IN', { dateStyle: 'medium' })}</span>
                </div>
              )}
              {selectedNode.member.blood_group && (
                <div className="flex justify-between">
                  <span className="text-[#859490]">Blood Group:</span>
                  <span>{selectedNode.member.blood_group}</span>
                </div>
              )}
              {selectedNode.member.email && (
                <div className="flex justify-between">
                  <span className="text-[#859490]">Email:</span>
                  <span className="truncate max-w-[150px]">{selectedNode.member.email}</span>
                </div>
              )}
              {selectedNode.member.phone && (
                <div className="flex justify-between">
                  <span className="text-[#859490]">Phone:</span>
                  <span>{selectedNode.member.phone}</span>
                </div>
              )}
            </div>

            {/* Relationships Config */}
            <div className="space-y-4">
              <h4 className="text-label-md text-white/80 font-semibold uppercase tracking-wider text-[10px]">Relationships</h4>

              {/* Show Parent link details */}
              {selectedNode.parent_id ? (
                <div className="p-3.5 rounded-2xl bg-white/3 border border-white/5 flex items-center justify-between text-body-sm">
                  <div>
                    <p className="text-[10px] text-[#859490] uppercase tracking-wider font-semibold font-mono">
                      {selectedNode.relationship_to_parent || 'Parent'}
                    </p>
                    <p className="font-semibold text-white">
                      {nodes.find((n) => n.id === selectedNode.parent_id)?.member.full_name || 'Unknown'}
                    </p>
                  </div>
                  <span className="material-symbols-outlined text-[#4fdbc8] text-[18px]">family_history</span>
                </div>
              ) : (
                <p className="text-body-sm text-[#859490] italic">No parent linked in tree.</p>
              )}

              {/* Show Spouse link details */}
              {selectedNode.metadata?.spouse_node_id ? (
                <div className="p-3.5 rounded-2xl bg-white/3 border border-white/5 flex items-center justify-between text-body-sm">
                  <div>
                    <p className="text-[10px] text-[#859490] uppercase tracking-wider font-semibold font-mono">Spouse</p>
                    <p className="font-semibold text-white">
                      {nodes.find((n) => n.id === selectedNode.metadata?.spouse_node_id)?.member.full_name || 'Unknown'}
                    </p>
                  </div>
                  <span className="material-symbols-outlined text-[#ffb59e] text-[18px]">favorite</span>
                </div>
              ) : (
                <p className="text-body-sm text-[#859490] italic">No spouse linked in tree.</p>
              )}
            </div>
          </div>

          {/* Action Footer */}
          <div className="p-4 border-t border-white/5 bg-[#0e1513]/50 flex flex-col gap-2">
            <button
              onClick={() => setShowRelationModal(true)}
              className="w-full py-2.5 rounded-xl font-medium transition-all text-label-sm bg-white/5 border border-white/8 hover:bg-[#4fdbc8]/10 hover:border-[#4fdbc8]/25 text-[#4fdbc8]"
            >
              Configure Relations
            </button>
            <div className="flex gap-2">
              <Link
                href={`/family?tab=members&id=${selectedNode.member_id}`}
                className="flex-1 py-2 rounded-xl font-medium text-center transition-all text-label-sm bg-white/3 border border-white/5 text-[#bbcac6] hover:bg-white/5"
              >
                Edit Profile
              </Link>
              <button
                onClick={() => handleRemoveNode(selectedNode.id)}
                className="flex-1 py-2 rounded-xl font-medium transition-all text-label-sm bg-red-950/20 border border-red-900/30 text-red-400 hover:bg-red-950/40"
              >
                Hide from Tree
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. Right Sidebar mapping unmapped members */}
      {showUnmappedSidebar && (
        <div className="absolute top-24 right-6 bottom-24 w-80 z-20 pointer-events-auto bg-[#161d1b]/95 border border-white/8 backdrop-blur-xl rounded-3xl flex flex-col overflow-hidden shadow-2xl animate-in fade-in slide-in-from-right-4 duration-300">
          <div className="p-5 border-b border-white/5 flex items-center justify-between">
            <h2 className="text-headline-sm font-semibold text-[#dde4e1]">Unmapped Members</h2>
            <button
              onClick={() => setShowUnmappedSidebar(false)}
              className="p-1 rounded-lg hover:bg-white/5 text-[#859490] hover:text-white"
            >
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-5 space-y-3">
            {unmappedMembers.length === 0 ? (
              <div className="text-center py-10 space-y-2">
                <span className="material-symbols-outlined text-[36px] text-[#859490]">checklist</span>
                <p className="text-body-sm text-[#bbcac6]">All family members are currently in the family tree.</p>
              </div>
            ) : (
              unmappedMembers.map((member) => (
                <div
                  key={member.id}
                  className="p-3.5 rounded-2xl bg-white/3 border border-white/5 flex items-center justify-between gap-3 hover:border-white/10 transition-all"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-[11px] font-bold shrink-0 relative overflow-hidden"
                      style={{ 
                        background: member.avatar_url ? 'transparent' : getAvatarStyle(member.full_name) 
                      }}
                    >
                      {member.avatar_url ? (
                        <img
                          src={member.avatar_url}
                          alt={member.full_name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        getInitials(member.full_name)
                      )}
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-body-sm font-semibold text-white truncate">{member.full_name}</h4>
                      <p className="text-[10px] text-[#859490] capitalize">{member.relationship || 'Member'}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleAddMemberToTree(member.id)}
                    className="p-1.5 rounded-lg bg-[#4fdbc8]/10 text-[#4fdbc8] border border-[#4fdbc8]/20 hover:bg-[#4fdbc8]/20"
                    title="Add node to tree canvas"
                  >
                    <span className="material-symbols-outlined text-[18px]">add</span>
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* 6. NexusModal - Configure Relations */}
      <NexusModal
        isOpen={showRelationModal}
        onClose={() => setShowRelationModal(false)}
        title={`Edit Connections — ${selectedNode?.member.full_name}`}
        description="Establish parents and spouse nodes to draw relationship lines on the canvas"
        size="md"
      >
        <div className="space-y-5 py-2">
          {/* Parent selection */}
          <div className="space-y-2">
            <label className="text-label-md text-[#bbcac6]">Parent Node</label>
            <select
              value={parentSelection}
              onChange={(e) => setParentSelection(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-white/8 bg-[#0e1513] text-body-sm text-white focus:outline-none focus:border-[#4fdbc8]"
            >
              <option value="none">None (Root Node)</option>
              {nodes
                .filter((n) => n.id !== selectedNode?.id)
                .map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.member.full_name}
                  </option>
                ))}
            </select>
          </div>

          {/* Relationship label */}
          {parentSelection !== 'none' && (
            <div className="space-y-2">
              <label className="text-label-md text-[#bbcac6]">Relationship to Parent</label>
              <div className="grid grid-cols-3 gap-2">
                {['father', 'mother', 'child'].map((rel) => (
                  <button
                    key={rel}
                    type="button"
                    onClick={() => setRelationshipType(rel)}
                    className={`py-2 rounded-xl text-label-sm font-medium border capitalize transition-all ${
                      relationshipType === rel
                        ? 'bg-[#4fdbc8]/15 border-[#4fdbc8] text-[#4fdbc8]'
                        : 'bg-white/3 border-white/5 text-[#bbcac6] hover:bg-white/5'
                    }`}
                  >
                    {rel}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Spouse selection */}
          <div className="space-y-2">
            <label className="text-label-md text-[#bbcac6]">Spouse Node</label>
            <select
              value={spouseSelection}
              onChange={(e) => setSpSelection(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-white/8 bg-[#0e1513] text-body-sm text-white focus:outline-none focus:border-[#4fdbc8]"
            >
              <option value="none">None</option>
              {nodes
                .filter((n) => n.id !== selectedNode?.id)
                .map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.member.full_name}
                  </option>
                ))}
            </select>
            <p className="text-[10px] text-[#859490]">Spouses are linked horizontally via dashed lines.</p>
          </div>

          {/* Buttons */}
          <div className="flex gap-3 pt-4">
            <button
              onClick={() => setShowRelationModal(false)}
              className="flex-1 py-3 rounded-xl font-semibold border border-white/8 text-[#bbcac6] bg-white/3 hover:bg-white/5 transition-all"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveRelationships}
              className="flex-1 py-3 rounded-xl font-semibold bg-[#4fdbc8] text-[#003731] hover:bg-[#4fdbc8]/90 transition-all shadow-[0_4px_16px_rgba(79,219,200,0.2)]"
            >
              Save Relations
            </button>
          </div>
        </div>
      </NexusModal>

      {/* 7. NexusModal - Add New Profile */}
      <NexusModal
        isOpen={showAddMemberModal}
        onClose={() => setShowAddMemberModal(false)}
        title="Add New Family Profile"
        description="Create a profile details record and automatically place it on the family tree canvas"
        size="md"
      >
        <form onSubmit={handleCreateAndAdd} className="space-y-4 py-2">
          <div className="space-y-2">
            <label className="text-label-md text-[#bbcac6]">Full Name</label>
            <input
              type="text"
              required
              placeholder="e.g. Arjun Neralla"
              value={newMemberName}
              onChange={(e) => setNewMemberName(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-white/8 bg-[#0e1513] text-body-sm text-white focus:outline-none focus:border-[#4fdbc8]"
            />
          </div>

          <div className="space-y-2">
            <label className="text-label-md text-[#bbcac6]">Relationship to Owner</label>
            <select
              value={newMemberRelation}
              onChange={(e) => setNewMemberRelation(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-white/8 bg-[#0e1513] text-body-sm text-white focus:outline-none focus:border-[#4fdbc8]"
            >
              <option value="Husband">Husband</option>
              <option value="Wife">Wife</option>
              <option value="Son">Son</option>
              <option value="Daughter">Daughter</option>
              <option value="Father">Father</option>
              <option value="Mother">Mother</option>
              <option value="Brother">Brother</option>
              <option value="Sister">Sister</option>
              <option value="Other">Other</option>
            </select>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={() => setShowAddMemberModal(false)}
              className="flex-1 py-3 rounded-xl font-semibold border border-white/8 text-[#bbcac6] bg-white/3 hover:bg-white/5 transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 py-3 rounded-xl font-semibold bg-[#4fdbc8] text-[#003731] hover:bg-[#4fdbc8]/90 transition-all"
            >
              Create & Add
            </button>
          </div>
        </form>
      </NexusModal>

    </div>
  );
}
