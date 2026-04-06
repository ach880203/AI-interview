package com.aimentor.security;

import com.aimentor.domain.user.UserEntity;
import com.aimentor.domain.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;

import java.util.List;

/**
 * Spring Security UserDetailsService 구현체
 * JwtAuthenticationFilter에서 이메일로 사용자를 조회할 때 호출
 * loadUserByUsername(email) → UserDetails 반환 → SecurityContext 저장
 */
@Service
@RequiredArgsConstructor
public class CustomUserDetailsService implements UserDetailsService {

    private final UserRepository userRepository;

    /**
     * 이메일로 사용자 조회 후 UserDetails 생성
     * 권한(ROLE_USER, ROLE_ADMIN)을 GrantedAuthority로 변환
     */
    @Override
    public UserDetails loadUserByUsername(String email) throws UsernameNotFoundException {
        UserEntity user = userRepository.findByEmail(email)
                .orElseThrow(() -> new UsernameNotFoundException("사용자를 찾을 수 없습니다: " + email));

        // Spring Security 규칙: 권한 이름은 "ROLE_" 접두사 필요
        String authority = "ROLE_" + user.getRole().name(); // ROLE_USER or ROLE_ADMIN

        return org.springframework.security.core.userdetails.User.builder()
                .username(user.getEmail())
                .password(user.getPassword())
                .authorities(new SimpleGrantedAuthority(authority))
                .build();
    }
}
