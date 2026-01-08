package extraction

import "time"

// ExtractionResult represents the structured data extracted from a document.
type ExtractionResult struct {
	// Document classification
	DocumentType string `json:"document_type"` // manual, receipt, invoice, warranty, permit, inspection, service_record, photo, other
	Confidence   float64 `json:"confidence"`    // 0.0 to 1.0

	// Common fields
	Title       string     `json:"title,omitempty"`
	Date        *time.Time `json:"date,omitempty"`
	Description string     `json:"description,omitempty"`

	// Equipment/System identification
	Equipment *EquipmentInfo `json:"equipment,omitempty"`

	// Financial information
	Financial *FinancialInfo `json:"financial,omitempty"`

	// Service/Maintenance information
	Service *ServiceInfo `json:"service,omitempty"`

	// Warranty information
	Warranty *WarrantyInfo `json:"warranty,omitempty"`

	// Suggested category for the system
	SuggestedCategory string `json:"suggested_category,omitempty"` // HVAC, Plumbing, Electrical, Appliances, etc.

	// Raw extracted text (for searchability)
	RawText string `json:"raw_text,omitempty"`

	// Any additional notes or context
	Notes string `json:"notes,omitempty"`
}

// EquipmentInfo contains equipment/system identification data.
type EquipmentInfo struct {
	Manufacturer string `json:"manufacturer,omitempty"`
	Model        string `json:"model,omitempty"`
	SerialNumber string `json:"serial_number,omitempty"`
	PartNumber   string `json:"part_number,omitempty"`
	Capacity     string `json:"capacity,omitempty"`     // e.g., "3 ton", "50 gallon"
	Specifications string `json:"specifications,omitempty"` // Other specs
}

// FinancialInfo contains cost and vendor information.
type FinancialInfo struct {
	Vendor        string  `json:"vendor,omitempty"`
	VendorAddress string  `json:"vendor_address,omitempty"`
	VendorPhone   string  `json:"vendor_phone,omitempty"`
	Amount        float64 `json:"amount,omitempty"`
	Currency      string  `json:"currency,omitempty"`
	PaymentMethod string  `json:"payment_method,omitempty"`
	InvoiceNumber string  `json:"invoice_number,omitempty"`
	ReceiptNumber string  `json:"receipt_number,omitempty"`
}

// ServiceInfo contains service/maintenance details.
type ServiceInfo struct {
	ServiceType   string `json:"service_type,omitempty"`   // installation, repair, maintenance, inspection
	Provider      string `json:"provider,omitempty"`
	ProviderPhone string `json:"provider_phone,omitempty"`
	Technician    string `json:"technician,omitempty"`
	WorkPerformed string `json:"work_performed,omitempty"`
	PartsUsed     string `json:"parts_used,omitempty"`
	NextServiceDue string `json:"next_service_due,omitempty"`
}

// WarrantyInfo contains warranty details.
type WarrantyInfo struct {
	WarrantyType   string     `json:"warranty_type,omitempty"`   // manufacturer, extended, labor
	Coverage       string     `json:"coverage,omitempty"`
	StartDate      *time.Time `json:"start_date,omitempty"`
	EndDate        *time.Time `json:"end_date,omitempty"`
	DurationMonths int        `json:"duration_months,omitempty"`
	Provider       string     `json:"provider,omitempty"`
	ClaimPhone     string     `json:"claim_phone,omitempty"`
	PolicyNumber   string     `json:"policy_number,omitempty"`
}

// SystemPrompt is the system prompt for document extraction.
const SystemPrompt = `You are an expert at extracting structured information from home-related documents. Your task is to analyze documents (receipts, invoices, manuals, warranty cards, service records, equipment photos, permits, inspections) and extract relevant information in a structured JSON format.

Be thorough but only include fields that you can confidently extract from the document. For dates, use ISO 8601 format (YYYY-MM-DD). For currency amounts, extract just the numeric value.

Document types to identify:
- manual: Product manuals, user guides, installation instructions
- receipt: Purchase receipts, sales slips
- invoice: Service invoices, bills
- warranty: Warranty cards, certificates, extended warranty documents
- permit: Building permits, installation permits
- inspection: Inspection reports, certificates
- service_record: Maintenance logs, service records
- photo: Photos of equipment, data plates, serial numbers
- other: Documents that don't fit other categories

Categories for home systems:
- HVAC: Heating, ventilation, air conditioning, furnaces, heat pumps
- Plumbing: Water heaters, pipes, fixtures, water treatment
- Electrical: Panels, wiring, generators, solar
- Appliances: Kitchen appliances, laundry, etc.
- Roofing: Roof, gutters, skylights
- Exterior: Siding, windows, doors, decks
- Interior: Flooring, paint, fixtures
- Landscaping: Irrigation, outdoor equipment
- Security: Alarms, cameras, locks
- Other: Anything else`

// UserPrompt is the user prompt template for document extraction.
const UserPrompt = `Please analyze this document and extract all relevant information. Return your response as a JSON object with the following structure:

{
  "document_type": "receipt|invoice|manual|warranty|permit|inspection|service_record|photo|other",
  "confidence": 0.95,
  "title": "Brief descriptive title",
  "date": "YYYY-MM-DD",
  "description": "Brief description of what this document is",
  "equipment": {
    "manufacturer": "Brand name",
    "model": "Model number",
    "serial_number": "Serial number",
    "part_number": "Part number if applicable",
    "capacity": "Size/capacity if applicable",
    "specifications": "Other relevant specs"
  },
  "financial": {
    "vendor": "Store or company name",
    "vendor_address": "Address if shown",
    "vendor_phone": "Phone if shown",
    "amount": 123.45,
    "currency": "USD",
    "payment_method": "Credit card, cash, etc.",
    "invoice_number": "Invoice/order number",
    "receipt_number": "Receipt number"
  },
  "service": {
    "service_type": "installation|repair|maintenance|inspection",
    "provider": "Company name",
    "provider_phone": "Phone number",
    "technician": "Technician name",
    "work_performed": "Description of work",
    "parts_used": "Parts replaced or installed",
    "next_service_due": "When next service is recommended"
  },
  "warranty": {
    "warranty_type": "manufacturer|extended|labor",
    "coverage": "What's covered",
    "start_date": "YYYY-MM-DD",
    "end_date": "YYYY-MM-DD",
    "duration_months": 12,
    "provider": "Warranty provider",
    "claim_phone": "Phone for claims",
    "policy_number": "Policy/warranty number"
  },
  "suggested_category": "HVAC|Plumbing|Electrical|Appliances|Roofing|Exterior|Interior|Landscaping|Security|Other",
  "raw_text": "Key text content for searchability",
  "notes": "Any additional relevant observations"
}

Only include fields that you can extract from the document. Omit fields that aren't present or can't be determined. The confidence score should reflect how certain you are about the document type classification.`
