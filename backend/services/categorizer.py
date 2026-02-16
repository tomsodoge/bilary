from typing import Optional

class InvoiceCategorizer:
    """Categorize invoices based on keywords in subject and content"""
    
    CATEGORIES = {
        "Digital Service": [
            "subscription", "saas", "hosting", "software", "domain", "cloud",
            "server", "api", "license", "digital", "online service", "webhosting",
            "abonnement", "abo", "mitgliedschaft"
        ],
        "Physical Product": [
            "shipping", "delivery", "package", "tracking", "warehouse", "versand",
            "lieferung", "paket", "shipped", "dispatched", "product", "produkt"
        ],
        "Online Course": [
            "course", "training", "education", "udemy", "coursera", "skillshare",
            "learning", "kurs", "schulung", "workshop", "webinar", "tutorial"
        ],
    }
    
    def categorize(self, subject: str = "", content: str = "") -> str:
        """
        Categorize invoice based on subject and content.
        Returns category name or 'Other' if no match found.
        """
        text = f"{subject} {content}".lower()
        
        # Check each category
        for category, keywords in self.CATEGORIES.items():
            for keyword in keywords:
                if keyword.lower() in text:
                    return category
        
        return "Other"
    
    def get_all_categories(self) -> list:
        """Return list of all available categories"""
        return list(self.CATEGORIES.keys()) + ["Other"]

# Global categorizer instance
categorizer = InvoiceCategorizer()
