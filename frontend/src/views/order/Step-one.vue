<template>
    <div>
        <div class="flex flex-wrap">
            <div class="w-full mb-4">
                <Tracker></Tracker>
                <div class="w-full max-w-xl mx-auto">
                    <form class="bg-white px-8 pt-6 pb-8 mb-4">
                        <div class="mb-4">
                            <label class="block
                            text-gray-700
                            text-sm
                            font-bold mb-2" for="address-from">
                                Dirección de recojo
                            </label>
                            <input class="shadow
                            appearance-none
                            border rounded
                            w-full
                            py-2
                            px-3
                            text-gray-700
                            leading-tight
                            focus:outline-none
                            focus:shadow-outline"
                            id="address-from"
                            type="text">
                        </div>
                        <div class="mb-4">
                            <label class="block
                            text-gray-700
                            text-sm
                            font-bold mb-2" for="address-from-floor">
                                Piso del departamento o casa
                            </label>
                            <input class="shadow
                            appearance-none
                            border rounded
                            w-full
                            py-2
                            px-3
                            text-gray-700
                            leading-tight
                            focus:outline-none
                            focus:shadow-outline"
                            placeholder="Ejem: 2"
                            id="address-from-floor"
                            type="text">
                        </div>
                        <div class="border-b border-1 my-10"></div>
                        <div class="mb-6">
                            <label class="block
                            text-gray-700
                            text-sm
                            font-bold
                            mb-2"
                            for="address-to">
                                Dirección de envío
                            </label>
                            <input class="shadow
                            appearance-none
                            border rounded
                            w-full
                            py-2
                            px-3
                            text-gray-700
                            leading-tight
                            focus:outline-none
                            focus:shadow-outline"
                            id="address-to"
                            type="text">
                        </div>
                        <div class="mb-4">
                            <label class="block
                            text-gray-700
                            text-sm
                            font-bold mb-2" for="address-to-floor">
                                Piso del departamento o casa
                            </label>
                            <input class="shadow
                            appearance-none
                            border rounded
                            w-full
                            py-2
                            px-3
                            text-gray-700
                            leading-tight
                            focus:outline-none
                            focus:shadow-outline"
                            placeholder="3"
                            id="address-to-floor"
                            type="text">
                        </div>
                        <div class="flex items-center justify-end">
                            <button class="bg-green-500
                            hover:bg-green-700
                            text-white
                            font-bold
                            py-2
                            px-4
                            rounded
                            focus:outline-none
                            focus:shadow-outline"
                            type="button">
                                Siguiente
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    </div>
</template>

<script>
// @ is an alias to /src
import Tracker from '@/components/Tracker.vue';

export default {
  name: 'step-one',
  components: {
    Tracker,
  },
};
</script>
