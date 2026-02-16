package cmd

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"os"
	"path/filepath"
	"time"

	"github.com/hausdog/cli/internal/client"
	"github.com/spf13/cobra"
)

var (
	docPropertyID string
	docItemID     string
	docStatus     string
	docFilePath   string
	docStdin      bool
	docURL        string
)

var documentsCmd = &cobra.Command{
	Use:   "documents",
	Short: "Manage documents",
	Long:  `List, upload, and delete documents. Key command for document processing workflow.`,
}

var documentsListCmd = &cobra.Command{
	Use:   "list",
	Short: "List documents for a property",
	Run: func(cmd *cobra.Command, args []string) {
		if docPropertyID == "" {
			outputError("Property ID required", fmt.Errorf("use --property flag"))
		}

		c := client.New(getAPIURL(), requireAPIKey())

		path := fmt.Sprintf("/properties/%s/documents", docPropertyID)
		if docStatus != "" {
			path += "?status=" + docStatus
		}

		data, err := c.Get(path)
		if err != nil {
			outputError("Failed to list documents", err)
		}

		var documents []map[string]interface{}
		if err := json.Unmarshal(data, &documents); err != nil {
			outputError("Failed to parse response", err)
		}

		outputJSON(documents)
	},
}

var documentsGetCmd = &cobra.Command{
	Use:   "get <id>",
	Short: "Get a document by ID",
	Args:  cobra.ExactArgs(1),
	Run: func(cmd *cobra.Command, args []string) {
		c := client.New(getAPIURL(), requireAPIKey())

		data, err := c.Get("/documents/" + args[0])
		if err != nil {
			outputError("Failed to get document", err)
		}

		var document map[string]interface{}
		if err := json.Unmarshal(data, &document); err != nil {
			outputError("Failed to parse response", err)
		}

		outputJSON(document)
	},
}

var documentsUploadCmd = &cobra.Command{
	Use:   "upload",
	Short: "Upload a document",
	Long: `Upload a document file for processing.

The document will be uploaded to storage and queued for OCR/extraction processing.
Poll the document status using 'documents get <id>' to check processing progress.

Examples:
  # Upload from file (primary method)
  hausdog documents upload --property <id> --file /path/to/photo.jpg

  # Upload and associate with an item
  hausdog documents upload --property <id> --file /path/to/receipt.pdf --item <item-id>`,
	Run: func(cmd *cobra.Command, args []string) {
		if docPropertyID == "" {
			outputError("Property ID required", fmt.Errorf("use --property flag"))
		}

		if docFilePath == "" {
			outputError("File path required", fmt.Errorf("use --file flag"))
		}

		// Open the file
		file, err := os.Open(docFilePath)
		if err != nil {
			outputError("Failed to open file", err)
		}
		defer file.Close()

		// Get file info
		fileInfo, err := file.Stat()
		if err != nil {
			outputError("Failed to get file info", err)
		}

		// Create multipart form
		var buf bytes.Buffer
		writer := multipart.NewWriter(&buf)

		part, err := writer.CreateFormFile("file", filepath.Base(docFilePath))
		if err != nil {
			outputError("Failed to create form file", err)
		}

		if _, err := io.Copy(part, file); err != nil {
			outputError("Failed to copy file", err)
		}

		writer.Close()

		// Build URL
		uploadURL := getAPIURL() + fmt.Sprintf("/properties/%s/documents/upload", docPropertyID)
		if docItemID != "" {
			uploadURL += "?itemId=" + docItemID
		}

		// Create request
		req, err := http.NewRequest("POST", uploadURL, &buf)
		if err != nil {
			outputError("Failed to create request", err)
		}

		req.Header.Set("Authorization", "Bearer "+requireAPIKey())
		req.Header.Set("Content-Type", writer.FormDataContentType())

		// Send request
		httpClient := &http.Client{Timeout: 60 * time.Second}
		resp, err := httpClient.Do(req)
		if err != nil {
			outputError("Upload failed", err)
		}
		defer resp.Body.Close()

		body, err := io.ReadAll(resp.Body)
		if err != nil {
			outputError("Failed to read response", err)
		}

		if resp.StatusCode >= 400 {
			var apiErr client.APIError
			if err := json.Unmarshal(body, &apiErr); err == nil && apiErr.Message != "" {
				outputError("Upload failed", fmt.Errorf("%s", apiErr.Message))
			}
			outputError("Upload failed", fmt.Errorf("status %d: %s", resp.StatusCode, string(body)))
		}

		var result map[string]interface{}
		if err := json.Unmarshal(body, &result); err != nil {
			outputError("Failed to parse response", err)
		}

		// Add file info to output
		result["uploadedFile"] = filepath.Base(docFilePath)
		result["fileSize"] = fileInfo.Size()

		outputJSON(result)
	},
}

var documentsDeleteCmd = &cobra.Command{
	Use:   "delete <id>",
	Short: "Delete a document",
	Args:  cobra.ExactArgs(1),
	Run: func(cmd *cobra.Command, args []string) {
		c := client.New(getAPIURL(), requireAPIKey())

		_, err := c.Delete("/documents/" + args[0])
		if err != nil {
			outputError("Failed to delete document", err)
		}

		outputJSON(map[string]string{
			"status":  "deleted",
			"id":      args[0],
			"message": "Document deleted successfully",
		})
	},
}

func init() {
	rootCmd.AddCommand(documentsCmd)
	documentsCmd.AddCommand(documentsListCmd)
	documentsCmd.AddCommand(documentsGetCmd)
	documentsCmd.AddCommand(documentsUploadCmd)
	documentsCmd.AddCommand(documentsDeleteCmd)

	// List flags
	documentsListCmd.Flags().StringVar(&docPropertyID, "property", "", "Property ID (required)")
	documentsListCmd.Flags().StringVar(&docStatus, "status", "", "Filter by status: pending, processing, ready_for_review, confirmed")
	documentsListCmd.MarkFlagRequired("property")

	// Upload flags
	documentsUploadCmd.Flags().StringVar(&docPropertyID, "property", "", "Property ID (required)")
	documentsUploadCmd.Flags().StringVar(&docFilePath, "file", "", "Path to file to upload (required)")
	documentsUploadCmd.Flags().StringVar(&docItemID, "item", "", "Associate with item ID")
	documentsUploadCmd.MarkFlagRequired("property")
	documentsUploadCmd.MarkFlagRequired("file")
}
