FROM cofoundry-artifact-builder:node24.18.1 AS toolchain
FROM scratch
COPY --from=toolchain /usr/local/bin/node /runtime/node
COPY --from=toolchain /lib/ld-linux-aarch64.so.1 /lib/ld-linux-aarch64.so.1
COPY --from=toolchain /lib/aarch64-linux-gnu/libdl.so.2 /lib/aarch64-linux-gnu/libdl.so.2
COPY --from=toolchain /lib/aarch64-linux-gnu/libstdc++.so.6* /lib/aarch64-linux-gnu/
COPY --from=toolchain /lib/aarch64-linux-gnu/libm.so.6 /lib/aarch64-linux-gnu/libm.so.6
COPY --from=toolchain /lib/aarch64-linux-gnu/libgcc_s.so.1 /lib/aarch64-linux-gnu/libgcc_s.so.1
COPY --from=toolchain /lib/aarch64-linux-gnu/libpthread.so.0 /lib/aarch64-linux-gnu/libpthread.so.0
COPY --from=toolchain /lib/aarch64-linux-gnu/libc.so.6 /lib/aarch64-linux-gnu/libc.so.6
COPY --from=toolchain /etc/ssl/certs /etc/ssl/certs
USER 65534:65534
ENV PATH=/runtime HOME=/tmp
ENTRYPOINT ["/runtime/node"]
