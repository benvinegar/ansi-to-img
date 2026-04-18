export type Cell = {
  char: string;
  fg: string;
  bg: string | null;
  bold: boolean;
};

export type Defaults = {
  fg: string;
};

export type RenderOptions = {
  fontSize: number;
  lineHeight: number;
  padding: number;
  bg: string;
  fg: string;
  width: number;
};

export type CliOptions = RenderOptions & {
  output: string;
  input: string | null;
};
