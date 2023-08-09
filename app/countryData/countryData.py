import os

class CountryData:

    def __init__(self, country=None):
        self.country = country
        self.email_peru = "carlos_calderon@chalan.pe"
        self.email_mexico = "carlos_calderon@chalan.mx"
        self.phone_peru = "972 643 007"
        self.phone_mexico = "56 2145-8596"
    def contact(self):
        data = {
            "peru": {
                "email": self.email_peru,
                "phone": self.phone_peru,
            },
            "mexico": {
                "email": self.email_mexico,
                "phone": self.phone_mexico,
            }
        }
        return data[self.country]

    def faq(self):
        data = {
            "peru": {
                "email": self.email_peru,
                "phone": self.phone_peru,
            },
            "mexico": {
                "email": self.email_mexico,
                "phone": self.phone_mexico,
            }
        }
        return data[self.country]

    def terms(self):
        data = {
            "peru": {
                "email": self.email_peru,
                "phone": self.phone_peru,
            },
            "mexico": {
                "email": self.email_mexico,
                "phone": self.phone_mexico,
            }
        }
        return data[self.country]

    def get_country(self):
        data = {
            "peru": "Perú",
            "mexico": "México"
        }
        return data[self.country]