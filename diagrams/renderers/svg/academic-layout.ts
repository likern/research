export type AcademicPrimitive =
  | {
      kind: 'reference-edge';
      from: string;
      to: string;
    }
  | {
      kind: 'temporal-edge';
      from: string;
      to: string;
      label?: string;
    }
  | {
      kind: 'marker';
      role: 'linearization-point' | 'visibility-selection';
      target: string;
    }
  | {
      kind: 'witness';
      steps: string[];
    };

export interface LayoutOptions {
  profile: 'academic-paper' | 'textbook' | 'web';
  monochrome?: boolean;
}

export function createAcademicLayout(
  primitives: AcademicPrimitive[],
  options: LayoutOptions,
) {
  return {
    profile: options.profile,
    monochrome: options.monochrome ?? false,
    primitives,
  };
}
