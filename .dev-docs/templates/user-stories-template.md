# User Story: [Story Title - e.g., Convert Image to WebP]

- **ID**: US-[Sequential Number]  
- **Status**: [Draft/Validated]  
- **Created By**: Storyteller Mode

---

## 1. Description _(Core User Need)_

**As a** [Type of User],  
**I want to** [perform some action/achieve some goal],  
**so that** [I receive some value/benefit].

**Example:**  
_As a Digital Organizer,_  
_I want to convert a single JPG image to WebP format,_  
_so that I can optimize website loading speed and save storage space._

---

## 2. Acceptance Criteria _(Definition of "Done" for this Story)_

This section defines the measurable conditions that must be met for this user story to be considered complete and successful from the user's perspective. Each criterion should be testable.

### Scenario: Successful Conversion
- **Given** the user provides a valid JPG input file and a WebP output format  
- **When** the conversion command is executed  
- **Then** a new `.webp` file is created at the specified output location  
- **And** the original `.jpg` input file remains unchanged  
- **And** the created `.webp` file opens correctly in a standard image viewer  

### Scenario: Handling Invalid Input
- **Given** the user provides a non-existent or corrupted input file  
- **When** the conversion command is executed  
- **Then** the tool displays a clear error message indicating the issue  
- **And** no output file is created  

### Scenario: Overwriting Existing File (if applicable)
- **Given** an output file with the same name already exists at the target location  
- **When** the conversion command is executed without an explicit overwrite flag  
- **Then** the tool prompts the user for confirmation before overwriting  

---

## 3. INVEST Validation _(Storyteller's Internal Quality Check)_

This section is for the Storyteller AI's internal assessment to ensure the story's quality. It should be completed by the Storyteller before marking the story as 'Validated'.

- **Independent**: [Yes/No] – _If No, briefly explain why and suggest potential splitting/rephrasing._  
- **Negotiable**: [Yes/No] – _If No, indicate if the description is too prescriptive of a solution._  
- **Valuable**: [Yes/No] – _If No, clarify what value is missing or unclear._  
- **Estimable**: [Yes/No] – _If No, highlight areas of ambiguity or missing information that prevent estimation._  
- **Small**: [Yes/No] – _If No, suggest how it might be broken down into smaller, shippable units._  
- **Testable**: [Yes/No] – _If No, point out vague acceptance criteria or lack of clear verification._

---

## 4. Notes & Refinement History _(Storyteller's Log)_

- [Any additional context or clarifying details gathered during user interaction.]  
- **[Date: YYYY-MM-DD]** – Storyteller: _Initial draft created._  
- **[Date: YYYY-MM-DD]** – Storyteller: _Validated with user, minor adjustments made to ACs._
