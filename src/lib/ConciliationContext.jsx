import React, { createContext, useContext, useState, useEffect } from "react";

const ConciliationContext = createContext();

const STORAGE_KEY = "conciliacao_session";

export function ConciliationProvider({ children }) {
  const [state, setState] = useState({
    step: "upload",
    fileName: "",
    matches: [],
    filter: "all",
    selectedIds: new Set(),
  });

  // Restaurar do localStorage ao montar
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      setState({
        ...parsed,
        selectedIds: new Set(parsed.selectedIds || []),
      });
    }
  }, []);

  // Salvar no localStorage quando estado muda
  useEffect(() => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        ...state,
        selectedIds: Array.from(state.selectedIds),
      })
    );
  }, [state]);

  const updateState = (updates) => {
    setState((prev) => ({ ...prev, ...updates }));
  };

  const clearSession = () => {
    setState({
      step: "upload",
      fileName: "",
      matches: [],
      filter: "all",
      selectedIds: new Set(),
    });
    localStorage.removeItem(STORAGE_KEY);
  };

  return (
    <ConciliationContext.Provider value={{ state, updateState, clearSession }}>
      {children}
    </ConciliationContext.Provider>
  );
}

export function useConciliation() {
  const context = useContext(ConciliationContext);
  if (!context) {
    throw new Error("useConciliation deve ser usado dentro de ConciliationProvider");
  }
  return context;
}