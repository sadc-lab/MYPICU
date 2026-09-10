/**
 * Poignée de glisser-déposer (Brush) avec une zone tactile plus généreuse
 * que son rendu visuel — même largeur affichée qu'avant (8px), mais une
 * zone cliquable/tactile élargie autour, pour rester utilisable au doigt
 * en contexte clinique (tablette) sans alourdir visuellement le graphique.
 * `travellerWidth` doit être réglé sur BRUSH_TOUCH_WIDTH sur le <Brush />
 * qui utilise ce rendu : c'est cette valeur qui détermine la zone de hit,
 * pas seulement l'apparence.
 */
export const BRUSH_TOUCH_WIDTH = 28;
const BRUSH_VISUAL_WIDTH = 8;

interface TravellerProps {
  x: number;
  y: number;
  width: number;
  height: number;
  stroke?: string;
}

export function renderWideTouchTraveller({ x, y, width, height, stroke }: TravellerProps) {
  const visualX = x + (width - BRUSH_VISUAL_WIDTH) / 2;
  const lineY = Math.floor(y + height / 2) - 1;
  return (
    <g>
      {/* Zone tactile élargie, invisible — capte le clic/tap sans changer le visuel */}
      <rect x={x} y={y} width={width} height={height} fill="transparent" />
      {/* Poignée visuelle — taille inchangée */}
      <rect x={visualX} y={y} width={BRUSH_VISUAL_WIDTH} height={height} fill={stroke} stroke="none" />
      <line x1={visualX + 1} y1={lineY} x2={visualX + BRUSH_VISUAL_WIDTH - 1} y2={lineY} fill="none" stroke="#fff" />
      <line x1={visualX + 1} y1={lineY + 2} x2={visualX + BRUSH_VISUAL_WIDTH - 1} y2={lineY + 2} fill="none" stroke="#fff" />
    </g>
  );
}
