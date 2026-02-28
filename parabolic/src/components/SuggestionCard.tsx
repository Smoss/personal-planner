"use client";

import { useState } from "react";
import { Card, CardContent, CardActions, Button, Typography, Box, Chip, Snackbar } from "@mui/material";
import CheckIcon from "@mui/icons-material/Check";
import CloseIcon from "@mui/icons-material/Close";
import LightbulbIcon from "@mui/icons-material/Lightbulb";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Suggestion } from "@/lib/convex";

interface SuggestionCardProps {
  suggestion: Suggestion;
  onAccepted?: () => void;
  onRejected?: () => void;
}

export function SuggestionCard({ suggestion, onAccepted, onRejected }: SuggestionCardProps) {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<"pending" | "accepted" | "rejected">("pending");
  const [error, setError] = useState<string | null>(null);

  const acceptSuggestionMutation = useMutation(api.chat.acceptSuggestionAction);

  const handleAccept = async () => {
    setLoading(true);
    try {
      await acceptSuggestionMutation({ suggestion });
      setStatus("accepted");
      onAccepted?.();
    } catch {
      setError("Failed to accept suggestion");
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async () => {
    setLoading(true);
    try {
      // Just update local state - the suggestion is ephemeral
      setStatus("rejected");
      onRejected?.();
    } catch {
      setError("Failed to reject suggestion");
    } finally {
      setLoading(false);
    }
  };

  if (status !== "pending") {
    return (
      <Card sx={{ mb: 2, opacity: 0.7 }}>
        <CardContent>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Chip
              size="small"
              color={status === "accepted" ? "success" : "default"}
              label={status === "accepted" ? "Added" : "Skipped"}
            />
            <Typography variant="body2" color="text.secondary">
              {suggestion.title}
            </Typography>
          </Box>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card sx={{ mb: 2, borderLeft: 4, borderColor: "warning.main" }}>
        <CardContent>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
            <LightbulbIcon color="warning" />
            <Typography variant="h6" component="div">
              Suggested Task
            </Typography>
          </Box>
          <Typography variant="h6" gutterBottom>
            {suggestion.title}
          </Typography>
          {suggestion.description && (
            <Typography variant="body2" color="text.secondary" gutterBottom>
              {suggestion.description}
            </Typography>
          )}
          <Typography variant="caption" color="text.secondary">
            {suggestion.reasoning}
          </Typography>
        </CardContent>
        <CardActions>
          <Button
            size="small"
            variant="contained"
            color="success"
            startIcon={<CheckIcon />}
            onClick={handleAccept}
            disabled={loading}
          >
            Accept
          </Button>
          <Button
            size="small"
            variant="outlined"
            color="inherit"
            startIcon={<CloseIcon />}
            onClick={handleReject}
            disabled={loading}
          >
            Reject
          </Button>
        </CardActions>
      </Card>
      <Snackbar
        open={!!error}
        autoHideDuration={6000}
        onClose={() => setError(null)}
        message={error}
      />
    </>
  );
}
