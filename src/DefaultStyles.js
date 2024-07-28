import { StyleSheet } from "react-native";
import structuredClone from "@ungap/structured-clone";

/**
 * Creates a StyleSheet border.
 * @param {{color?: string, style?: string, width?: number, radius?: number}} opts
 */
function border(opts) {
  if (!opts) opts = {};

  return {
    borderColor: opts.color || "#aaa",
    borderStyle: opts.style || "solid",
    borderWidth: opts.width || 1,
    borderRadius: opts.radius || 0,
  };
}

const iWidth = 250;

const themes = {
  dark: {
    defaultText: "#ddd",
    brightText: "white",
    background: "black",
    dimmedBackground: "#242424",
    lighterDimmedBackground: "#383838",
  },
  light: {
    defaultText: "#111",
    brightText: "darkblue",
    background: "white",
    dimmedBackground: "#eee",
    lighterDimmedBackground: "#888",
  },
};

let theme = themes.light;

export function setTheme(newTheme) {
  theme = themes[newTheme];
}

// the theme doesn't update, so we have to make chain lots
// of funcs to make it work. In <MainApp.tsx>, when the theme
// changes, it calls a function to update the styles
// in <ComponentAliases.jsx> which calls this.
function generateStyle() {
  const defaults = {
    fontSize: 15,
    color: theme.defaultText,
  };

  const headers = {
    h1: {
      fontWeight: "bold",
      marginBottom: 15,
      fontSize: defaults.fontSize * 2,
      color: theme.brightText,
    },
    h2: {
      fontWeight: "bold",
      marginTop: 10,
      marginBottom: 10,
      fontSize: defaults.fontSize * 1.75,
      color: theme.defaultText,
    },
    h3: {
      fontWeight: "bold",
      marginTop: 8,
      marginBottom: 8,
      fontSize: defaults.fontSize * 1.5,
      color: theme.defaultText,
    },
    h4: {
      fontWeight: "bold",
      marginTop: 5,
      marginBottom: 5,
      fontSize: defaults.fontSize * 1.25,
      color: theme.defaultText,
    },
  };

  const list = {
    list_inner: {
      padding: 10,
    },
    list_outer: {
      paddingHorizontal: 10,
    },
    list_text: {
      ...defaults,
      textAlign: "center",
    },
    list_full: {
      backgroundColor: theme.dimmedBackground,
      borderRadius: 10,
      height: "auto",
      maxHeight: 390,
      width: iWidth,
      marginBottom: 15,
    },
  };

  return StyleSheet.create({
    root: {
      height: "100%",
      backgroundColor: theme.background,
      textAlign: "center",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
    },
    ...headers,
    ...list,
    text: {
      ...defaults,
      color: theme.defaultText,
      marginBottom: 2,
    },
    button_inner: {
      ...defaults,
      textAlign: "center",
    },
    button_outer: {
      ...defaults,
      backgroundColor: theme.dimmedBackground,
      width: iWidth,
      padding: 5,
      margin: 8,
      ...border({ radius: 10, color: "transparent" }),
    },
    hr: {
      height: 1,
      width: iWidth * 1.3,
      backgroundColor: theme.lighterDimmedBackground,
      marginVertical: 10,
    },
    textInput: {
      ...border({ radius: 10, color: "transparent" }),
      ...defaults,
      padding: 5,
      paddingHorizontal: 10,
      width: iWidth,
      textAlign: "left",
      backgroundColor: theme.dimmedBackground,
      marginBottom: 8,
    },
  });
}

export default generateStyle;
