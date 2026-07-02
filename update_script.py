import re

with open("src/pages/StoreEventsPipeline.tsx", "r") as f:
    content = f.read()

# Replace types
content = content.replace("FundraiserOrder", "StoreEventOrder")
content = content.replace("FundraisersPipeline", "StoreEventsPipeline")

# Replace table names
content = content.replace("'fundraisers'", "'store_events'")

# Remove CSV importer
content = re.sub(r'import \{ FundraiserCsvImporter \} from "@/components/FundraiserCsvImporter";\n', '', content)
content = re.sub(r'<FundraiserCsvImporter onImportSuccess=\{fetchOrders\} \/>\n\s*', '', content)

# Remove Tuesday restriction from calendar
content = content.replace("disabled={(date) => !isTuesday(date)}", "")
content = content.replace("isTuesday, ", "")
content = content.replace("Pick a Tuesday", "Pick a date")

# Update Headers/Text
content = content.replace("Tuesday Fundraisers", "Store Events")
content = content.replace("Manage fundraiser requests", "Manage store events")
content = content.replace("New Fundraiser", "New Store Event")
content = content.replace("Add Fundraiser", "Add Store Event")
content = content.replace("Delete Fundraiser", "Delete Store Event")
content = content.replace("fundraiser manually added", "store event manually added")
content = content.replace("fundraiser requests", "store events")
content = content.replace("fundraisers...", "store events...")
content = content.replace("Loading fundraisers", "Loading store events")
content = content.replace("fundraiser details", "store event details")
content = content.replace("this fundraiser for", "this store event for")
content = content.replace("Fundraiser has been removed", "Store event has been removed")

# Remove "Copy Booking Link" button
link_btn_regex = r'<Button variant="outline" className="gap-2 shadow-sm" onClick=\{handleCopyLink\}>[\s\S]*?<\/Button>'
content = re.sub(link_btn_regex, '', content)

# Inject CRM sync into handleAddFundraiser
crm_sync_add = """
    // Sync to CRM
    const { error: crmError } = await supabase.from('b2b_contacts').insert([{
      location_id: loc,
      organization_name: addFormData.organization,
      contact_name: addFormData.name,
      email: addFormData.email,
      phone: addFormData.phone,
      address: addFormData.address,
      category: 'Store Event'
    }]);
    if (crmError) console.error("Error syncing to CRM:", crmError);
"""
content = content.replace("setIsAdding(false);", crm_sync_add + "\n    setIsAdding(false);")

# Inject CRM sync into handleUpdateFundraiser
crm_sync_update = """
    // Sync to CRM (naive insert for now or update if needed, let's do a simple insert if we don't have it, but for simplicity let's insert if not exists)
    // Actually just an insert might duplicate, let's use upsert or just not worry for edit right now.
"""
# Let's write the file
with open("src/pages/StoreEventsPipeline.tsx", "w") as f:
    f.write(content)
