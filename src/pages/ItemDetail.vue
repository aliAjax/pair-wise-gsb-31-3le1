<template>
  <section v-if="item" class="page detail-page">
    <RouterLink class="text-link" to="/home">返回首页</RouterLink>
    <div class="detail-layout">
      <ItemImageGallery :images="item.images" :fallback-text="item.category" />
      <article class="detail-panel">
        <div class="item-card__topline">
          <span class="pill">{{ item.category }}</span>
          <span class="status-pill" :class="statusToneClass(item.status)">
            {{ formatItemStatus(item.status) }}
          </span>
        </div>
        <h1>{{ item.title }}</h1>
        <p>{{ item.description }}</p>
        <dl class="detail-list">
          <div>
            <dt>成色</dt>
            <dd>{{ formatCondition(item.condition) }}</dd>
          </div>
          <div>
            <dt>地点</dt>
            <dd>{{ item.location }}</dd>
          </div>
          <div>
            <dt>发布时间</dt>
            <dd>{{ formatDate(item.created_at) }}</dd>
          </div>
        </dl>
        <UserBrief v-if="owner" :user="owner" />

        <div v-if="!isMine" class="exchange-box">
          <div class="bundle-picker">
            <span class="bundle-picker__label">
              我的交换物（可勾 1-{{ MAX_BUNDLE_ITEMS }} 件组合交换，已选 {{ selectedItemIds.length }} 件）
            </span>
            <label
              v-for="myItem in ownItems"
              :key="myItem.id"
              class="bundle-option"
              :class="{ 'bundle-option--blocked': !isSelectable(myItem) }"
            >
              <input
                type="checkbox"
                :value="myItem.id"
                :checked="selectedItemIds.includes(myItem.id)"
                :disabled="!isSelectable(myItem) || (isLimitReached && !selectedItemIds.includes(myItem.id))"
                @change="toggleItem(myItem.id)"
              />
              <span>{{ myItem.title }}</span>
              <small v-if="myItem.status === ItemStatus.SWAPPING">交换中</small>
              <small v-else-if="isOccupied(myItem)">已被其他方案占用</small>
              <small v-else-if="myItem.status !== ItemStatus.AVAILABLE">
                {{ formatItemStatus(myItem.status) }}
              </small>
            </label>
            <p v-if="!ownItems.length" class="form-note">{{ FORM_MESSAGES.exchangeNeedOwnItem }}</p>
          </div>
          <label>
            留言
            <textarea v-model="messageText" rows="3" />
          </label>
          <button class="primary-button" type="button" :disabled="item.status !== ItemStatus.AVAILABLE" @click="requestExchange">
            发起交换
          </button>
        </div>
        <button v-else-if="item.status === ItemStatus.AVAILABLE" class="secondary-button" type="button" @click="offlineItem">
          下架这件物品
        </button>
      </article>
    </div>
  </section>
  <EmptyState v-else title="物品不存在" description="可能已被清理或链接无效" mark="404" />
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { RouterLink, useRoute } from 'vue-router';

import EmptyState from '@/components/common/EmptyState.vue';
import ItemImageGallery from '@/components/common/ItemImageGallery.vue';
import UserBrief from '@/components/common/UserBrief.vue';
import { ExchangeStatus, MAX_BUNDLE_ITEMS } from '@/constants/exchange';
import { ItemStatus } from '@/constants/item';
import { FORM_MESSAGES } from '@/constants/messages';
import type { Item } from '@/models/item';
import { useAuthStore } from '@/stores/authStore';
import { useExchangeStore } from '@/stores/exchangeStore';
import { useItemStore } from '@/stores/itemStore';
import { formatCondition, formatDate, formatItemStatus, statusToneClass } from '@/utils/formatters';
import { message } from '@/utils/message';

const route = useRoute();
const itemStore = useItemStore();
const authStore = useAuthStore();
const exchangeStore = useExchangeStore();

const item = computed(() => itemStore.items.find((entry) => entry.id === route.params.id));
const owner = computed(() => authStore.users.find((user) => user.id === item.value?.user_id));
const isMine = computed(() => authStore.currentUser?.id === item.value?.user_id);
const isOccupied = (entry: Item) => exchangeStore.occupiedItemIds.has(entry.id);
const isSelectable = (entry: Item) => entry.status === ItemStatus.AVAILABLE && !isOccupied(entry);

// 可交换的排在前面；交换中/被占用的也列出来但禁选，让发起方看清哪件发不出去
const ownItems = computed(() => {
  if (!authStore.currentUser) return [];
  const mine = itemStore
    .myItems(authStore.currentUser.id)
    .filter((entry) => entry.status !== ItemStatus.OFFLINE && entry.status !== ItemStatus.EXCHANGED);
  return [...mine].sort((a, b) => Number(isSelectable(b)) - Number(isSelectable(a)));
});
const selectedItemIds = ref<string[]>([]);
const messageText = ref('我想用这几件闲置与你组合交换，可以沟通时间和地点。');

const isLimitReached = computed(() => selectedItemIds.value.length >= MAX_BUNDLE_ITEMS);

const toggleItem = (itemId: string) => {
  if (selectedItemIds.value.includes(itemId)) {
    selectedItemIds.value = selectedItemIds.value.filter((id) => id !== itemId);
    return;
  }
  if (isLimitReached.value) {
    message(FORM_MESSAGES.exchangeBundleLimit, 'error');
    return;
  }
  selectedItemIds.value = [...selectedItemIds.value, itemId];
};

const requestExchange = async () => {
  if (!authStore.currentUser || !item.value || !owner.value) return;
  if (!itemStore.assertCanExchange(authStore.currentUser.id)) return;
  if (!selectedItemIds.value.length) {
    message(FORM_MESSAGES.exchangeNeedSelection, 'error');
    return;
  }
  const created = await exchangeStore.create({
    from_user_id: authStore.currentUser.id,
    to_user_id: owner.value.id,
    from_item_id: selectedItemIds.value[0],
    from_item_ids: [...selectedItemIds.value],
    to_item_id: item.value.id,
    status: ExchangeStatus.PENDING,
    message: messageText.value,
  });
  if (created) {
    selectedItemIds.value = [];
  }
};

const offlineItem = async () => {
  if (!item.value) return;
  await itemStore.offline(item.value.id);
};
</script>
