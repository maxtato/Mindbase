type FieldErrorKey =
  | "name"
  | "projectType"
  | "subcategory"
  | "priority"
  | "customSubcategoryLabel"
  | "customSubcategoryColor";

export interface CreateProjectFormState {
  errors?: Partial<Record<FieldErrorKey, string>>;
  message?: string;
}

export const initialCreateProjectFormState: CreateProjectFormState = {};
