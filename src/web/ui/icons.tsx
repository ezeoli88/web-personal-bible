import type { ReactNode } from "react";

interface IconProps {
  size?: number;
}

function Icon({ size = 22, children }: IconProps & { children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

export const ChevronLeftIcon = (props: IconProps) => <Icon {...props}><path d="M15 18l-6-6 6-6" /></Icon>;
export const ChevronRightIcon = (props: IconProps) => <Icon {...props}><path d="M9 6l6 6-6 6" /></Icon>;
export const ChevronDownIcon = (props: IconProps) => <Icon {...props}><path d="M6 9l6 6 6-6" /></Icon>;
export const CloseIcon = (props: IconProps) => <Icon {...props}><path d="M18 6L6 18M6 6l12 12" /></Icon>;
export const CompareIcon = (props: IconProps) => <Icon {...props}><path d="M7 7h13M16 3l4 4-4 4M17 17H4M8 21l-4-4 4-4" /></Icon>;
export const CopyIcon = (props: IconProps) => (
  <Icon {...props}><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V5a2 2 0 0 1 2-2h10" /></Icon>
);
export const ShareIcon = (props: IconProps) => (
  <Icon {...props}>
    <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
    <path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4" />
  </Icon>
);
export const HighlightIcon = (props: IconProps) => (
  <Icon {...props}><path d="M9 11l-5 5v4h4l5-5M14 6l4 4M12 8l6-6 4 4-6 6z" /></Icon>
);
export const SparkleIcon = (props: IconProps) => <Icon {...props}><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" /></Icon>;
export const ShieldIcon = (props: IconProps) => <Icon {...props}><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" /></Icon>;
export const DownloadIcon = (props: IconProps) => <Icon {...props}><path d="M12 3v12M7 10l5 5 5-5M5 21h14" /></Icon>;
export const LogoutIcon = (props: IconProps) => (
  <Icon {...props}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" /></Icon>
);
export const LoginIcon = (props: IconProps) => (
  <Icon {...props}><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5M15 12H3" /></Icon>
);
export const UserIcon = (props: IconProps) => <Icon {...props}><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></Icon>;
