
import React from 'react';

interface JiggleTextProps {
  children: React.ReactNode;
  colorClass?: string;
}

const JiggleText: React.FC<JiggleTextProps> = ({ children, colorClass = 'text-green-400' }) => {
  return (
    <div className={`text-jiggle font-mono text-sm tracking-widest uppercase ${colorClass}`}>
      {children}
    </div>
  );
};

export default JiggleText;
