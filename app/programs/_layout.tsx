import React from "react";
import { View, StyleSheet } from "react-native";
import { Slot } from "expo-router";

export default function ProgramsLayout() {
  return (
    <View style={styles.container}>
      <Slot />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0B0B0F",
  },
});
