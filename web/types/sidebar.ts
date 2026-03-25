// Sidebar-specific types

/**
 * Sidebar navigation order configuration
 */
export interface SidebarNavOrder {
  start: string[]; // Array of href paths for navigation items
  learnResearch: string[]; // Kept for backwards compatibility (unused)
}

/**
 * Sidebar constants
 */
export const SIDEBAR_MIN_WIDTH = 64;
export const SIDEBAR_MAX_WIDTH = 320;
export const SIDEBAR_DEFAULT_WIDTH = 256;
export const SIDEBAR_COLLAPSED_WIDTH = 64;

/**
 * Default sidebar description
 */
export const DEFAULT_SIDEBAR_DESCRIPTION = "DeepTutor++";

/**
 * Default navigation order
 */
export const DEFAULT_NAV_ORDER: SidebarNavOrder = {
  start: ["/", "/courses"],
  learnResearch: [],
};
