"use client";

import dynamic from "next/dynamic";

// Drawn in the browser only: rendering a whole job on the server can run the
// Worker past its limit, and the page would fail for the printing person.
export default dynamic(() => import("@/components/print-job"), { ssr: false, loading: () => <p className="p-8 text-sm text-fog">Opening the print job…</p> });
