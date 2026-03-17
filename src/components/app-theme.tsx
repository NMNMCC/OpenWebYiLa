import { CssBaseline, ThemeProvider, createTheme, useMediaQuery } from "@mui/material";
import type React from "react";

export default function AppTheme({ children }: React.PropsWithChildren) {
  const prefersDarkMode = useMediaQuery("(prefers-color-scheme: dark)");
  const theme = createTheme({
    palette: {
      mode: prefersDarkMode ? "dark" : "light",
    },
  });

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline enableColorScheme />
      {children}
    </ThemeProvider>
  );
}
