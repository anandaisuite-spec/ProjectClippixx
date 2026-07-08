export type ThemeName = 'light' | 'dark';

export interface Theme {
    id: ThemeName;
    name: string;
    gradient: string;
    colors: {
        primary: string;
        accent: string;
        surface: string;
        text: string;
    };
}

export const themes: Record<ThemeName, Theme> = {
    light: {
        id: 'light',
        name: 'Light',
        gradient: 'linear-gradient(to right top, #f5f0ff, #f0e8ff, #ece4ff, #e8e0ff, #e4dcff, #dfe0ff, #dae4ff, #d6e8ff, #ceeeff, #c6f4ff, #c0f9fc, #bdfdf5)',
        colors: {
            primary: '#8b5cf6',
            accent: '#06b6d4',
            surface: 'rgba(139, 92, 246, 0.05)',
            text: '#1f2937',
        },
    },
    dark: {
        id: 'dark',
        name: 'Dark',
        gradient: 'linear-gradient(to right top, #1a062f, #14072a, #0e0724, #09071d, #040616, #070a18, #0a0e1a, #0d111c, #101829, #0f1f36, #0c2644, #022e52)',
        colors: {
            primary: '#a78bfa',
            accent: '#22d3ee',
            surface: 'rgba(139, 92, 246, 0.1)',
            text: '#f3f4f6',
        },
    },
};

export const defaultTheme: ThemeName = 'light';
