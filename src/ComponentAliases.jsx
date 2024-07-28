import * as components from "react-native";

import { Component as ReactComponent } from "react";
import createStyles from "./DefaultStyles";

/**
 * Creates a component alias for `Component`.
 * @param {ReactComponent} Component
 * @param {string} cssName The StyleSheet selector
 */
const a =
  (Component, cssName, addedProps = {}) =>
  props =>
    (
      <Component
        style={{
          ...(css[cssName] || {}),
          ...(props.cstyle || {}),
        }}
        {...props}
        {...addedProps}
      />
    );

let css = createStyles();
export function updateCss() {
  css = createStyles();
}

const headers = {
  Header1: a(components.Text, "h1"),
  Header2: a(components.Text, "h2"),
  Header3: a(components.Text, "h3"),
  Header4: a(components.Text, "h4"),
};

const ex = {
  Root: a(components.SafeAreaView, "root"),
  ...headers,
  Text: a(components.Text, "text"),
  Button: ({ children, onclick, outerStyle = {}, innerStyle = {} }) => (
    <components.View style={[css.button_outer, outerStyle]}>
      <components.Text
        onPress={onclick}
        style={[css.button_inner, innerStyle]}>
        {children || "Button"}
      </components.Text>
    </components.View>
  ),
  Hr: a(components.View, "hr"),
  TextInput: a(components.TextInput, "textInput", {
    placeholderTextColor: "#888",
  }),
  /**
   * @param {{data: string[]; keyExtractor: (item: string, index: number) => string;}} param0
   */
  List: ({ data, keyExtractor }) => (
    <components.View style={css.list_full}>
      <components.FlatList
        data={data}
        contentContainerStyle={css.list_outer}
        renderItem={({ item, index }) => (
          <components.View
            style={[
              css.list_inner,
              index < data.length - 1
                ? {
                    borderBottomColor: "#383838",
                    borderBottomWidth: 1,
                  }
                : {},
            ]}>
            <components.Text style={css.list_text}>{item}</components.Text>
          </components.View>
        )}
        keyExtractor={keyExtractor}
      />
    </components.View>
  ),
};

export default ex;
