# DAQ Raspberry Pi Deployment

An Ansible deployment for the Raspberry Pi that runs the
[Omnibus](https://github.com/waterloorocketry/omnibus) DAQ stack during system
tests and launch operations.

## What it configures

- NetworkManager, including a DHCP wired connection and the `UniversityOfWaterloo`
  Wi-Fi network.
- Chrony as the local NTP server for `192.168.0.0/24`.
- System package upgrades, Git, and `uv`.
- Docker Engine, Buildx, and the Compose plugin from Docker's Debian ARM64
  repository.
- The Omnibus server, sources, WebSocket services, DAQMS, and Parsley CAN
  sources through Docker Compose.
- code-server on port `9443`.
- Tailscale, using an authentication key provided by `TAILSCALE_KEY`.

## Prerequisites

- A Raspberry Pi running 64-bit Raspberry Pi OS/Debian with SSH access.
- A control machine with Python 3.13+ and [uv](https://docs.astral.sh/uv/).
- An inventory configured for the target. The included `inventory.yml` targets
  `daq.local` as the `daq` user.
- A Tailscale authentication key exported in the shell that runs the playbook:

  ```sh
  export TAILSCALE_KEY=<tailscale-auth-key>
  ```

Install the Python dependencies and required Ansible collections before the
first deployment:

```sh
uv sync
uv run ansible-galaxy collection install -r requirements.yml
```

## First-boot configuration

For a fresh Raspberry Pi OS image, copy the files in `cloud-init/` to the
image's boot partition before starting the Raspberry Pi.

## Deployment

```sh
uv run ansible-playbook -i inventory.yml -K -k main.yml
```

The deployment may reboot the target after a Docker package change.

## Helpers

- Remove Tailscale, including its package, service, repository, and local state:

  ```sh
  uv run ansible-playbook -i inventory.yml -K -k helpers/remove-tailscale.yml
  ```
