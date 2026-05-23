import { useState, useEffect } from "react";
import authFetch from "../utils/authFetch";

// Cache maintenance status for the current page lifecycle to avoid repeated calls.
const maintenanceStatusCache = {
  checked: false,
  maintenance: false,
  inFlight: null,
};

async function fetchMaintenanceStatus(API_URL) {
  if (maintenanceStatusCache.checked) {
    return {
      maintenance: maintenanceStatusCache.maintenance,
      checked: true,
    };
  }

  if (!maintenanceStatusCache.inFlight) {
    maintenanceStatusCache.inFlight = (async () => {
      try {
        const res = await authFetch(`${API_URL}/api/admin/public/maintenance`);
        if (res.ok) {
          const data = await res.json();
          maintenanceStatusCache.maintenance = data.maintenance_mode === true;
        }
      } catch {
        // Fall back to cached defaults when check fails.
      } finally {
        maintenanceStatusCache.checked = true;
        maintenanceStatusCache.inFlight = null;
      }

      return {
        maintenance: maintenanceStatusCache.maintenance,
        checked: maintenanceStatusCache.checked,
      };
    })();
  }

  return maintenanceStatusCache.inFlight;
}

export default function useMaintenanceMode() {
  const [maintenance, setMaintenance] = useState(maintenanceStatusCache.maintenance);
  const [checked, setChecked] = useState(maintenanceStatusCache.checked);
  const API_URL = import.meta.env.VITE_API_URL;

  useEffect(() => {
    let mounted = true;

    fetchMaintenanceStatus(API_URL).then((result) => {
      if (!mounted) return;
      setMaintenance(result.maintenance);
      setChecked(result.checked);
    });

    return () => {
      mounted = false;
    };
  }, [API_URL]);

  return { maintenance, checked };
}
