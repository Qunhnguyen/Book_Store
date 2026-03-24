import React from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import PublicLayout from '../layouts/PublicLayout';
import ProtectedRoute from './ProtectedRoute';
import LoginPage from '../../features/auth/LoginPage';
import AdminLoginPage from '../../features/auth/AdminLoginPage';
import RegisterPage from '../../features/auth/RegisterPage';
import HomeShowcasePage from '../../features/showcase/HomeShowcasePage';
import ProductDetailShowcasePage from '../../features/showcase/ProductDetailShowcasePage';
import CartShowcasePage from '../../features/showcase/CartShowcasePage';
import CheckoutShowcasePage from '../../features/showcase/CheckoutShowcasePage';
import ReviewsProfileShowcasePage from '../../features/showcase/ReviewsProfileShowcasePage';
import AdminShowcasePage from '../../features/showcase/AdminShowcasePage';

export default function AppRoutes() {
  return (
    <Routes>
      <Route element={<PublicLayout />}>
        <Route path="/" element={<HomeShowcasePage />} />
        <Route path="/book/:id" element={<ProductDetailShowcasePage />} />
        <Route path="/cart" element={<ProtectedRoute><CartShowcasePage /></ProtectedRoute>} />
        <Route path="/checkout" element={<ProtectedRoute><CheckoutShowcasePage /></ProtectedRoute>} />
        <Route path="/reviews-profile" element={<ProtectedRoute><ReviewsProfileShowcasePage /></ProtectedRoute>} />
        <Route path="/admin" element={<ProtectedRoute loginPath="/admin-login"><AdminShowcasePage /></ProtectedRoute>} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/admin-login" element={<AdminLoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
