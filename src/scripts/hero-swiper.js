// src/scripts/hero-swiper.js
import Swiper from 'swiper';
import { Navigation, Pagination, Autoplay } from 'swiper/modules';
// Импорт стилей Swiper (можно также оставить CDN-стили в BaseLayout, тогда эти строки можно удалить)
import 'swiper/css';
import 'swiper/css/navigation';
import 'swiper/css/pagination';

const el = document.querySelector('.hero-swiper');

if (el) {
  new Swiper(el, {
    modules: [Navigation, Pagination, Autoplay],
    loop: false,
    rewind: true,
    speed: 800,
    autoplay: {
      delay: 5000,
      disableOnInteraction: false,
    },
    navigation: {
      nextEl: '.swiper-button-next',
      prevEl: '.swiper-button-prev',
    },
    pagination: {
      el: '.swiper-pagination',
      clickable: true,
    },
  });
}