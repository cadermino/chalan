class OrderStatus:

    @staticmethod
    def pending():
        return 1

    @staticmethod
    def in_progress():
        return 2

    @staticmethod
    def completed():
        return 3

    @staticmethod
    def cancelled():
        return 4