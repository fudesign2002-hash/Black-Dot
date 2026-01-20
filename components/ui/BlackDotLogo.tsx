import React from 'react';

interface Props {
  treatAsCompact?: boolean;
  logoRotationStyle?: string;
  onClick?: () => void;
  ariaLabel?: string;
  className?: string;
}

export default function BlackDotLogo({ treatAsCompact = false, logoRotationStyle = 'none', onClick, ariaLabel = 'Black Dot logo', className = '' }: Props) {
  const size = treatAsCompact ? 24 : 40;
  const classes = `stroke-current transition-transform duration-500 ease-out shrink-0 pointer-events-auto cursor-pointer ${className}`;
  
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      width={size} 
      height={size} 
      viewBox="0 0 40 40" 
      fill="none"
      className={classes}
      style={{ transform: logoRotationStyle }}
      onClick={onClick}
      aria-label={ariaLabel}
    >
      <g clipPath="url(#clip0_14_21)">
        <path d="M39.7002 0.299805V39.7002H0.299805V0.299805H39.7002Z" stroke="currentColor" strokeWidth="0.6"/>
        <path d="M24.7214 0V40" stroke="currentColor" strokeWidth="0.6"/>
        <path d="M0 24.7214H40" stroke="currentColor" strokeWidth="0.6"/>
        <path d="M15.2786 24.7214V40" stroke="currentColor" strokeWidth="0.2"/>
        <path d="M12.3604 0.0996094C19.1316 0.0996094 24.6209 5.58912 24.6211 12.3604C24.6211 19.1317 19.1317 24.6211 12.3604 24.6211C5.58912 24.6209 0.0996094 19.1316 0.0996094 12.3604C0.0997867 5.58923 5.58923 0.0997867 12.3604 0.0996094Z" stroke="currentColor" strokeWidth="0.2"/>
        <path d="M7.63933 35.2786C9.25088 35.2786 10.5573 33.9722 10.5573 32.3607C10.5573 30.7491 9.25088 29.4427 7.63933 29.4427C6.02779 29.4427 4.72137 30.7491 4.72137 32.3607C4.72137 33.9722 6.02779 35.2786 7.63933 35.2786Z" fill="currentColor"/>
        <path d="M24.7214 15.2786H40" stroke="currentColor" strokeWidth="0.2"/>
      </g>
      <defs>
        <clipPath id="clip0_14_21">
          <rect width="40" height="40" fill="white"/>
        </clipPath>
      </defs>
    </svg>
  );
}
