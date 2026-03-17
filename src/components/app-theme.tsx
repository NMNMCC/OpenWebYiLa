import { createTheme, ThemeProvider } from "@mui/material";
import type React from "react";

const theme = createTheme({});

export default function AppTheme({ children }: React.PropsWithChildren) {
  return <ThemeProvider theme={theme}>{children}</ThemeProvider>;
}
