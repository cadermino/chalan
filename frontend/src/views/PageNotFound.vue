<template>
  <div>
    <div class="flex flex-wrap my-10">
      <div class="w-full mb-4 max-w-xl mx-auto">
        <div class="four_zero_four_bg">
          <h1 class="text-center ">404</h1>
        </div>
        <div class="contant_box_404 text-center">
          <h3 class="h2">
            Parece que andas perdido
          </h3>
          <p>La página que estas buscando no esta disponible :(</p>
          <div>
            <router-link to="/order/step-one" class="link_404 bg-blue-500
              hover:bg-blue-700
              text-white
              font-bold
              rounded-full
              py-4 px-8 tracking-wider">
              Agenda tu mudanza
            </router-link>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<!--<style scoped>
.four_zero_four_bg{
  background-image: url(https://cdn.dribbble.com/users/285475/screenshots/2083086/dribbble_1.gif);
  height: 400px;
  background-position: center;
}
.four_zero_four_bg h1{
  font-size:80px;
}
.four_zero_four_bg h3{
  font-size:80px;
}
.link_404{
  color: #fff!important;
  padding: 10px 20px;
  margin: 20px 0;
  display: inline-block;
}
.contant_box_404{
  margin-top:-50px;
}
</style>-->
