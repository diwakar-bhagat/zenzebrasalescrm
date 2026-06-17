export function analyzeRevenueDriver(revenueGrowth: number, billCutsGrowth: number, aovGrowth: number) {
  // If growth is close to 0 (e.g. < 1%), we consider it stable
  const isStable = (val: number) => Math.abs(val) < 1;

  let conclusion = "";

  if (isStable(revenueGrowth)) {
    conclusion = "Revenue is stable.";
  } else if (revenueGrowth > 0) {
    if (billCutsGrowth > aovGrowth && billCutsGrowth > 0) {
      conclusion = "Main Cause: Volume (Bill Cuts) increased.";
    } else if (aovGrowth > billCutsGrowth && aovGrowth > 0) {
      conclusion = "Main Cause: Average Order Value (AOV) increased.";
    } else {
      conclusion = "Both Volume and AOV increased.";
    }
  } else {
    // Revenue is down
    if (billCutsGrowth < aovGrowth && billCutsGrowth < 0) {
      conclusion = "Main Cause: Volume (Bill Cuts) dropped.";
    } else if (aovGrowth < billCutsGrowth && aovGrowth < 0) {
      conclusion = "Main Cause: Average Order Value (AOV) dropped.";
    } else {
      conclusion = "Both Volume and AOV dropped.";
    }
  }

  return {
    revenueStatus: revenueGrowth > 0 ? "Up" : revenueGrowth < 0 ? "Down" : "Stable",
    revenueGrowth,
    primaryDriver: conclusion
  };
}
