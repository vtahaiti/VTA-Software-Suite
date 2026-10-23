"use client";
import { createContext } from "react";
export const IosBackNavigation = createContext<(action: (() => void) | null) => void>(() => {});
