import brainSvg from '@/assets/brain-icon.svg';

interface BrainIconProps {
  className?: string;
  size?: number;
}

export const BrainIcon = ({ className = '', size = 24 }: BrainIconProps) => {
  return (
    <img 
      src={brainSvg} 
      alt="Brain" 
      className={className}
      style={{ width: size, height: size }}
    />
  );
};
