---
name: Design polish v14
description: Chart empty states, comparison toggle polish, mobile header spacing, UsageCharts graceful degradation
type: design
---
## Sprint v14 — Final Polish

### Chart Empty States
- UsageCharts now shows friendly empty state with icon + message when no data
- Each chart card gets individual placeholder: "Sem dados neste período"

### ComparisonToggle Polish  
- Increased padding to py-1.5, rounded-lg
- Added shadow-sm when active, hover:bg-primary/5 when inactive
- Added title tooltip for accessibility

### Mobile Header
- Increased gap from 1.5 to 2 on mobile for breathing room between icons

### Page Transitions
- Already implemented via DirectionalTransition (cross-fade + directional slide)
