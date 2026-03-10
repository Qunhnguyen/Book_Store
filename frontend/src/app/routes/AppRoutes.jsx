import { Navigate, Route, Routes } from 'react-router-dom';
import PublicLayout from '../layouts/PublicLayout';
import HomeShowcasePage from '../../features/showcase/HomeShowcasePage';
import ProductDetailShowcasePage from '../../features/showcase/ProductDetailShowcasePage';
import CartShowcasePage from '../../features/showcase/CartShowcasePage';
import CheckoutShowcasePage from '../../features/showcase/CheckoutShowcasePage';
import ReviewsProfileShowcasePage from '../../features/showcase/ReviewsProfileShowcasePage';
import AdminShowcasePage from '../../features/showcase/AdminShowcasePage';
import DashboardPage from '../../features/dashboard/DashboardPage';
import BooksPage from '../../features/books/BooksPage';
import CustomersPage from '../../features/customers/CustomersPage';
import CartPage from '../../features/cart/CartPage';
import OrdersPage from '../../features/orders/OrdersPage';
import PaymentsPage from '../../features/payments/PaymentsPage';
import ShipmentsPage from '../../features/shipments/ShipmentsPage';
import ReviewsPage from '../../features/reviews/ReviewsPage';
import CategoriesPage from '../../features/categories/CategoriesPage';
import ManagersPage from '../../features/managers/ManagersPage';
import StaffPage from '../../features/staff/StaffPage';
import RecommendationsPage from '../../features/recommendations/RecommendationsPage';

export default function AppRoutes() {
  return (
    <Routes>
      <Route element={<PublicLayout />}>
        <Route path="/" element={<HomeShowcasePage />} />
        <Route path="/book/:id" element={<ProductDetailShowcasePage />} />
        <Route path="/cart" element={<CartShowcasePage />} />
        <Route path="/checkout" element={<CheckoutShowcasePage />} />
        <Route path="/reviews-profile" element={<ReviewsProfileShowcasePage />} />
        <Route path="/admin" element={<AdminShowcasePage />} />
      </Route>

      <Route path="/ops" element={<DashboardPage />} />
      <Route path="/ops/books" element={<BooksPage />} />
      <Route path="/ops/customers" element={<CustomersPage />} />
      <Route path="/ops/cart" element={<CartPage />} />
      <Route path="/ops/orders" element={<OrdersPage />} />
      <Route path="/ops/payments" element={<PaymentsPage />} />
      <Route path="/ops/shipments" element={<ShipmentsPage />} />
      <Route path="/ops/reviews" element={<ReviewsPage />} />
      <Route path="/ops/categories" element={<CategoriesPage />} />
      <Route path="/ops/managers" element={<ManagersPage />} />
      <Route path="/ops/staff" element={<StaffPage />} />
      <Route path="/ops/recommendations" element={<RecommendationsPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
