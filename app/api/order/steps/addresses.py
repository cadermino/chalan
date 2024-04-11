from ..order import Order

class Addresses:

    def __init__(self, order_id):
        self.order_id = order_id
        self.order = Order(self.order_id).details()
        self.from_address = self.__get__from_address()
        self.to_address = self.__get__to_address()

    def requisites(self):
        return [
            "from_street",
            "from_floor_number",
            "from_zip_code",
            "from_country",
            "from_map_url",
            "to_street",
            "to_floor_number",
            "to_zip_code",
            "to_country",
            "to_map_url",
        ]

    def __get__from_address(self):
        order_details = self.order['order_details']
        from_address = {}
        for detail in order_details:
            if detail.get('type') == 'carry_from':
                from_address.update({"from_street": detail.get('street')})
                from_address.update({"from_floor_number": detail.get('floor_number')})
                from_address.update({'from_zip_code': detail.get('zip_code')})
                from_address.update({'from_country': detail.get('country')})
                from_address.update({'from_map_url': detail.get('map_url')})
        return from_address

    def __get__to_address(self):
        order_details = self.order['order_details']
        to_address = {}
        for detail in order_details:
            if detail.get('type') == 'deliver_to':
                to_address.update({'to_street': detail.get('street')})
                to_address.update({'to_floor_number': detail.get('floor_number')})
                to_address.update({'to_zip_code': detail.get('zip_code')})
                to_address.update({'to_country': detail.get('country')})
                to_address.update({'to_map_url': detail.get('map_url')})
        return to_address

    def is_complete(self):
        address_from_database = self.from_address
        address_from_database.update(self.to_address)
        is_complete = []
        for requisite in self.requisites():
            req = bool(address_from_database[requisite])
            if not is_complete:
                is_complete.append(req)
            else:
                is_complete[0] = (is_complete[0] and req)

        return is_complete[0]

    def has_changed(self, data):
        complete_address_data_from_request = data['orderDetailsOrigin']
        complete_address_data_from_request.update(data['orderDetailsDestination'])
        address_from_request = {}
        for requisite in self.requisites():
            address_from_request[requisite] = complete_address_data_from_request[requisite]

        address_from_database = self.from_address
        address_from_database.update(self.to_address)

        return address_from_database != address_from_request