import { Leaf } from 'lucide-react';

const LEAF_COLORS = ['text-maple-rust', 'text-gilmore-gold', 'text-porch-sage'];

const LEAVES = Array.from({ length: 20 }).map((_, i) => ({
  id: i,
  left: `${(i * 10 + 4) % 100}%`,
  delay: `${i * 1}s`,
  duration: `${16 + (i % 4) * 4}s`,
  size: 22 + (i % 3) * 10,
  color: LEAF_COLORS[i % LEAF_COLORS.length],
}));

export default function AutumnLeaves() {
  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden z-0" aria-hidden="true">
      {LEAVES.map((leaf) => (
        <Leaf
          key={leaf.id}
          size={leaf.size}
          strokeWidth={1.25}
          className={`absolute top-0 animate-leaf-fall opacity-0 ${leaf.color}`}
          style={{
            left: leaf.left,
            animationDelay: leaf.delay,
            animationDuration: leaf.duration,
          }}
        />
      ))}
    </div>
  );
}