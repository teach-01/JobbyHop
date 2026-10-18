import React from 'react';

const Button = ({
  children,
  onClick,
  disabled,
  type = 'button',
  className = '',
  variant = 'primary',
  ...props
}) => {
  const baseStyles = 'inline-flex items-center justify-center font-semibold transition-all duration-200 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed';
  
  const variants = {
    primary: 'bg-amber-500 hover:bg-amber-400 text-slate-950 px-4 py-2',
    outline: 'border-2 border-slate-700 hover:border-slate-600 text-white bg-transparent px-4 py-2',
    danger: 'bg-rose-500 hover:bg-rose-600 text-white px-4 py-2',
    secondary: 'bg-slate-800 hover:bg-slate-700 text-white px-4 py-2',
    ghost: 'text-slate-400 hover:text-white hover:bg-slate-800 px-3 py-1.5 rounded-lg'
  };

  const selectedVariant = variants[variant] || variants.primary;

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`${baseStyles} ${selectedVariant} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};

export default Button;
