import { useEffect, useState } from "react";
import authFetch from "../utils/authFetch";

export default function AuthImage({ src, alt = "", className = "", onError, ...rest }) {
  const [objectUrl, setObjectUrl] = useState("");

  useEffect(() => {
    let isActive = true;
    let nextObjectUrl = "";

    const loadImage = async () => {
      if (!src) {
        setObjectUrl("");
        return;
      }

      try {
        const res = await authFetch(src);
        if (!res.ok) {
          throw new Error(`Image request failed: ${res.status}`);
        }

        const blob = await res.blob();
        nextObjectUrl = URL.createObjectURL(blob);
        if (!isActive) {
          URL.revokeObjectURL(nextObjectUrl);
          return;
        }

        setObjectUrl((prev) => {
          if (prev.startsWith("blob:")) {
            URL.revokeObjectURL(prev);
          }
          return nextObjectUrl;
        });
      } catch (err) {
        if (isActive) {
          setObjectUrl((prev) => {
            if (prev.startsWith("blob:")) {
              URL.revokeObjectURL(prev);
            }
            return "";
          });
        }

        if (typeof onError === "function") {
          onError(err);
        }
      }
    };

    loadImage();

    return () => {
      isActive = false;
      if (nextObjectUrl.startsWith("blob:")) {
        URL.revokeObjectURL(nextObjectUrl);
      }
    };
  }, [src]);

  if (!objectUrl) return null;

  return <img src={objectUrl} alt={alt} className={className} {...rest} />;
}
