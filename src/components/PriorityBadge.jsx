import React, { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { priorityOf, priorityOptions, priorityDescriptions } from '../features/review/priority.js';
import './PriorityBadge.css';

export default function PriorityBadge({ severity, rowFocused = false, focusable = true }) {
  const priority = priorityOf(severity);
  const id = useId();
  const anchor = useRef(null);
  const tooltip = useRef(null);
  const leaveTimer = useRef(null);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [position, setPosition] = useState(null);
  const open = (hovered || focused || rowFocused) && !dismissed;

  useEffect(() => {
    setDismissed(false);
  }, [rowFocused]);
  useEffect(() => () => clearTimeout(leaveTimer.current), []);
  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const rect = anchor.current.getBoundingClientRect();
      const box = tooltip.current.getBoundingClientRect();
      setPosition({
        left: Math.max(
          12,
          Math.min(window.innerWidth - box.width - 12, rect.left + (rect.width - box.width) / 2),
        ),
        top: rect.top >= box.height + 20 ? rect.top - box.height - 8 : rect.bottom + 8,
      });
    };
    const escape = (event) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        setDismissed(true);
      }
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    document.addEventListener('keydown', escape, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
      document.removeEventListener('keydown', escape, true);
    };
  }, [open]);

  function enter() {
    clearTimeout(leaveTimer.current);
    setDismissed(false);
    setHovered(true);
  }
  function leave() {
    leaveTimer.current = setTimeout(() => setHovered(false), 120);
  }
  return (
    <>
      <span
        ref={anchor}
        className={`badge ${priority} priority-badge`}
        tabIndex={focusable ? 0 : undefined}
        aria-describedby={open ? id : undefined}
        onMouseEnter={enter}
        onMouseLeave={leave}
        onFocus={() => {
          setDismissed(false);
          setFocused(true);
        }}
        onBlur={() => setFocused(false)}
      >
        {priorityOptions[priority]}
      </span>
      {open &&
        createPortal(
          <span
            ref={tooltip}
            id={id}
            role="tooltip"
            className="priority-tooltip"
            style={position || { visibility: 'hidden' }}
            onMouseEnter={enter}
            onMouseLeave={leave}
          >
            {priorityDescriptions[priority]}
          </span>,
          document.body,
        )}
    </>
  );
}
